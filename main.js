(function () {
  'use strict';

  const ENABLED_KEY = 'qisplus_enabled';
  const IMPROVE_KEY = 'qisplus_improve';
  const HISTORY_KEY = 'qisplus_history';
  const WIDGET_ID   = 'qisplus-widget';
  const TOTAL_ECTS  = 180;

  // ─── 1. Semester helpers ──────────────────────────────────────────────────

  function semToNum(s) {
    const wise = s.match(/WiSe\s+(\d{2})\/\d{2}/);
    const sose = s.match(/SoSe\s+(\d{2,4})/);
    if (wise) return 2000 + parseInt(wise[1], 10) + 0.5;
    if (sose) { const y = parseInt(sose[1], 10); return y < 100 ? 2000 + y : y; }
    return 0;
  }

  function getReasonLabel(subStatus, remark) {
    if (subStatus === 'NB') return 'Nicht bestanden';
    if (subStatus === 'EN') return 'Endgültig nicht bestanden';
    if (subStatus === 'AN') {
      const map = {
        RT:  'Abgemeldet',
        AT:  'Rücktritt (Attest)',
        RM:  'Rücktritt (anerkannt)',
        NE:  'Nicht erschienen',
        NZ:  'Nicht zugelassen',
        ZW5: 'Zwangsfünf',
        NA5: 'Nicht angetreten',
        PNV: 'Notenverbesserungsversuch',
        FNB: 'Freiversuch (nicht bestanden)',
        PFV: 'Potenzieller Freiversuch',
      };
      return map[remark] ?? 'Angemeldet';
    }
    return subStatus;
  }

  // ─── 2. Parse modules (passed + ongoing + historical) ────────────────────

  function parseModules() {
    const tables = document.getElementsByTagName('table');
    if (tables.length < 2) return { modules: [], historical: [], currentSem: '', currentSemNum: 0 };
    const tbody = tables[1].tBodies[0] ?? tables[1].children[0];

    // Pass 1: find current semester = max semNum among all AN sub-rows
    let currentSemNum = 0;
    let currentSem    = '';
    for (const row of tbody.rows) {
      const cells = row.cells;
      if (!cells.length || cells[0].className.trim() !== 'ns_tabelle1_alignleft') continue;
      const subStatus = cells[4]?.textContent.trim();
      const subSem    = cells[2]?.textContent.trim();
      if (subStatus === 'AN') {
        const n = semToNum(subSem);
        if (n > currentSemNum) { currentSemNum = n; currentSem = subSem; }
      }
    }

    // Pass 2: build modules + historical
    const modules    = [];
    const historical = [];
    let cur          = null;

    for (const row of tbody.rows) {
      const cells = row.cells;
      if (!cells.length) continue;
      const fc = cells[0].className.trim();

      // ── Module header row ────────────────────────────────────────────
      if (fc === 'qis_konto' && cells[1]?.getAttribute('colspan') === '2') {
        const raw    = cells[1].textContent.trim();
        if (!raw.startsWith('Modul:')) { cur = null; continue; }
        const grade  = parseFloat(cells[2]?.textContent.trim().replace(',', '.'));
        const status = cells[3]?.textContent.trim();
        const ects   = parseInt(cells[4]?.textContent.trim(), 10);
        const name   = raw.replace(/^Modul:\s*/, '');

        if (status === 'BE' && !isNaN(grade) && !isNaN(ects) && ects > 0) {
          cur = {
            name, grade, ects,
            passedSem: null, passedSemNum: 0,
            ongoing: false,
            hasCurrentAN: false, ongoingSem: null, ongoingSemNum: 0,
          };
          modules.push(cur);
        } else if (status === 'PV') {
          cur = {
            name, grade: null, ects: 0,
            passedSem: null, passedSemNum: 0,
            ongoing: true,   // confirmed only if AN exists in currentSem
            hasCurrentAN: false, ongoingSem: null, ongoingSemNum: 0,
          };
          modules.push(cur);  // filtered later
        } else {
          cur = null;
        }
        continue;
      }

      // ── Sub-exam row ─────────────────────────────────────────────────
      if (fc === 'ns_tabelle1_alignleft' && cur) {
        const subName   = cells[1]?.textContent.trim() ?? '';
        const subSem    = cells[2]?.textContent.trim() ?? '';
        const subGrade  = parseFloat(cells[3]?.textContent.trim().replace(',', '.'));
        const subStatus = cells[4]?.textContent.trim() ?? '';
        const remark    = cells[6]?.textContent.trim() ?? '';
        const semNum    = semToNum(subSem);
        const isSL      = subName.includes('(Studienleistung)');

        // Track best passed sub-exam for display semester
        if (subStatus === 'BE' && !isNaN(subGrade) && subGrade > 0 && semNum > cur.passedSemNum) {
          cur.passedSemNum = semNum;
          cur.passedSem    = subSem;
        }

        // Track latest ongoing semester
        if (!isSL && subStatus === 'AN') {
          if (semNum === currentSemNum) cur.hasCurrentAN = true;
          if (semNum > cur.ongoingSemNum) {
            cur.ongoingSemNum = semNum;
            cur.ongoingSem    = subSem;
          }
        }

        // Historical: NB / EN / AN-with-remark / AN-in-past-semester (skip Studienleistung)
        if (!isSL) {
          const isHistorical =
              subStatus === 'NB' ||
              subStatus === 'EN' ||
              (subStatus === 'AN' && (remark !== '' || semNum < currentSemNum));

          if (isHistorical) {
            historical.push({
              moduleName:  cur.name,
              grade:       (!isNaN(subGrade) && subGrade > 0) ? subGrade : null,
              semester:    subSem,
              semNum,
              subStatus,
              remark,
              reasonLabel: getReasonLabel(subStatus, remark),
            });
          }
        }
      }
    }

    // Finalize: PV modules without AN in current semester → drop from main list
    const finalModules = modules.filter(m => {
      if (m.ongoing) {
        if (!m.hasCurrentAN) return false;
        m.passedSem    = m.ongoingSem;
        m.passedSemNum = m.ongoingSemNum;
      }
      return true;
    });

    return { modules: finalModules, historical, currentSem, currentSemNum };
  }

  // ─── 3. Mark improvable ───────────────────────────────────────────────────

  function markImprovable(modules) {
    const passed = modules.filter(m => !m.ongoing);
    if (!passed.length) return '';
    const maxSem = Math.max(...passed.map(m => m.passedSemNum));
    modules.forEach(m => { m.improvable = (!m.ongoing && m.passedSemNum === maxSem); });
    return passed.find(m => m.passedSemNum === maxSem)?.passedSem ?? '';
  }

  // ─── 4. Statistics ────────────────────────────────────────────────────────

  function calcStats(modules, withImprovement) {
    let earnedEcts = 0, weightedSum = 0;
    for (const m of modules) {
      if (m.ongoing) continue;
      const g = (withImprovement && m.improvable) ? 1.0 : m.grade;
      weightedSum += g * m.ects;
      earnedEcts  += m.ects;
    }
    const remaining      = Math.max(0, TOTAL_ECTS - earnedEcts);
    const currentAvg     = earnedEcts > 0 ? weightedSum / earnedEcts : null;
    const bestAchievable = (weightedSum + remaining * 1.0) / TOTAL_ECTS;
    return {
      currentAvg:     currentAvg !== null ? round2(currentAvg) : null,
      bestAchievable: round2(bestAchievable),
      earnedEcts, remaining,
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // ─── 5. Sorting / grouping ────────────────────────────────────────────────

  function getSortedData(modules, historical, sortCol, sortDir, showHistory) {
    if (sortCol === 'group') {
      const map = new Map();
      for (const m of modules) {
        const key = m.passedSem ?? '–';
        if (!map.has(key)) map.set(key, { semNum: m.passedSemNum, items: [], histItems: [] });
        map.get(key).items.push(m);
      }
      if (showHistory) {
        for (const h of historical) {
          const key = h.semester ?? '–';
          if (!map.has(key)) map.set(key, { semNum: h.semNum, items: [], histItems: [] });
          map.get(key).histItems.push(h);
        }
      }
      const groups = [...map.entries()].sort(([, a], [, b]) => a.semNum - b.semNum);
      groups.forEach(([, g]) => {
        g.items.sort((a, b) => a.name.localeCompare(b.name, 'de'));
        g.histItems.sort((a, b) => a.moduleName.localeCompare(b.moduleName, 'de'));
      });
      return { mode: 'grouped', groups };
    }
    // Flat sort — historical entries never shown here
    const sorted = [...modules].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name':     cmp = a.name.localeCompare(b.name, 'de');   break;
        case 'grade':    cmp = (a.grade ?? 99) - (b.grade ?? 99);   break;
        case 'ects':     cmp = a.ects - b.ects;                      break;
        case 'semester': cmp = a.passedSemNum - b.passedSemNum;      break;
      }
      return sortDir * cmp;
    });
    return { mode: 'flat', items: sorted };
  }

  // ─── 6. Misc helpers ──────────────────────────────────────────────────────

  function gradeColor(g) {
    if (g <= 1.5) return '#298836';
    if (g <= 2.5) return '#115E67';
    if (g <= 3.5) return '#ca5116';
    return '#A50034';
  }
  function fmt(g)  { return g.toFixed(2).replace('.', ','); }
  function el(tag, styles, html) {
    const e = document.createElement(tag);
    if (styles) Object.assign(e.style, styles);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // ─── 7. Build widget ──────────────────────────────────────────────────────

  function buildWidget(modules, historical, currentSem) {
    const lastSemLabel    = markImprovable(modules);
    const improvableCount = modules.filter(m => m.improvable).length;

    let sortCol     = 'group';
    let sortDir     = 1;
    let improve     = false;
    let showHistory = false;

    // ── DOM skeleton ──────────────────────────────────────────────────────
    const wrap = el('div', {
      margin: '0 0 20px', padding: '16px',
      background: '#f7fbff', border: '2px solid #ca5116',
      borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.5',
    });
    wrap.id = WIDGET_ID;

    wrap.appendChild(el('div',
        { fontWeight: 'bold', fontSize: '1.05em', color: '#ca5116', marginBottom: '14px' },
        '📊 QISPlus – Notenübersicht'));

    const progressBox = el('div', { marginBottom: '14px' });
    wrap.appendChild(progressBox);

    const badgesBox = el('div', { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' });
    wrap.appendChild(badgesBox);

    // ── Improvement toggle ────────────────────────────────────────────────
    const toggleBar = el('div', {
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '10px', padding: '8px 12px',
      background: '#e8f4f8', borderRadius: '4px', border: '1px solid #bee3f8',
    });
    toggleBar.innerHTML = `
      <span style="font-weight:bold;font-size:0.9em;color:#333;">Notenverbesserung</span>
      <span style="font-size:0.82em;color:#666;">${lastSemLabel} &middot; ${improvableCount} Module</span>
      <label style="position:relative;width:42px;height:24px;flex-shrink:0;margin-left:auto;cursor:pointer;">
        <input id="qp-imp" type="checkbox" style="display:none;">
        <span id="qp-track" style="position:absolute;inset:0;background:#ccc;border-radius:24px;transition:background .25s;"></span>
        <span id="qp-knob" style="position:absolute;top:3px;left:3px;width:18px;height:18px;
          background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.25);
          transition:transform .25s;pointer-events:none;"></span>
      </label>`;
    wrap.appendChild(toggleBar);

    // ── Control bar (reset sort + history toggle) ──────────────────────────
    const ctrlBar = el('div', {
      display: 'flex', gap: '8px', marginBottom: '12px',
      flexWrap: 'wrap', alignItems: 'center',
    });

    const btnResetSort = el('button', {
      padding: '5px 12px', fontSize: '0.82em', cursor: 'pointer',
      border: '1px solid #ca5116', borderRadius: '4px',
      background: '#fff', color: '#ca5116', fontWeight: 'bold',
      transition: 'opacity .2s',
    }, '↺ Sortierung zurücksetzen');
    ctrlBar.appendChild(btnResetSort);

    const btnHistory = el('button', {
      padding: '5px 12px', fontSize: '0.82em', cursor: 'pointer',
      border: '1px solid #888', borderRadius: '4px',
      background: '#fff', color: '#555', fontWeight: 'bold',
      transition: 'background .2s, color .2s',
    }, `📋 Frühere Versuche (${historical.length})`);
    ctrlBar.appendChild(btnHistory);

    wrap.appendChild(ctrlBar);

    const tableBox = el('div', {});
    wrap.appendChild(tableBox);

    const bestBox = el('div', {
      marginTop: '12px', padding: '8px 12px',
      background: '#fff8e1', borderRadius: '4px', border: '1px solid #ffe082',
    });
    wrap.appendChild(bestBox);

    // ── Column definitions ────────────────────────────────────────────────
    const COL_DEFS = [
      { key: 'name',     label: 'Modul',    align: 'left',   width: '40%' },
      { key: 'grade',    label: 'Note',     align: 'center', width: '12%' },
      { key: 'ects',     label: 'ECTS',     align: 'center', width: '8%'  },
      { key: 'semester', label: 'Semester', align: 'center', width: '16%' },
    ];

    // ── Render ────────────────────────────────────────────────────────────
    function updateControlBar() {
      const isDefault = sortCol === 'group' && sortDir === 1;
      btnResetSort.style.opacity = isDefault ? '0.4' : '1';
      btnResetSort.style.cursor  = isDefault ? 'default' : 'pointer';

      const inSortMode = sortCol !== 'group';
      if (showHistory && !inSortMode) {
        btnHistory.style.background = '#115E67';
        btnHistory.style.color      = '#fff';
        btnHistory.style.border     = '1px solid #0d4a52';
      } else {
        btnHistory.style.background = '#fff';
        btnHistory.style.color      = inSortMode ? '#bbb' : '#555';
        btnHistory.style.border     = `1px solid ${inSortMode ? '#ddd' : '#888'}`;
      }
      btnHistory.style.cursor = inSortMode ? 'not-allowed' : 'pointer';
      btnHistory.title = inSortMode ? 'Nur im Semestermodus verfügbar' : '';
    }

    function render(withImprovement) {
      improve = withImprovement;
      const s   = calcStats(modules, withImprovement);
      const pct = Math.min(100, Math.round((s.earnedEcts / TOTAL_ECTS) * 100));

      // Progress bar
      progressBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.84em;color:#555;margin-bottom:4px;">
          <span><b>${s.earnedEcts}</b> / ${TOTAL_ECTS} ECTS erreicht</span>
          <span><b>${s.remaining}</b> verbleibend &middot; ${pct}\u202f%</span>
        </div>
        <div style="height:10px;background:#e0e0e0;border-radius:5px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;
            background:linear-gradient(90deg,#ca5116,#e07040);
            border-radius:5px;transition:width .4s;"></div>
        </div>`;

      // Badges
      badgesBox.innerHTML = '';
      const badge = (html, bg) => el('span', {
        background: bg, color: '#fff', padding: '6px 14px',
        borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1em',
      }, html);
      if (s.currentAvg !== null)
        badgesBox.appendChild(badge(`&Oslash;&nbsp;aktuell:&nbsp;${fmt(s.currentAvg)}`, '#ca5116'));
      badgesBox.appendChild(badge(`${s.earnedEcts}&nbsp;ECTS`, '#115E67'));

      updateControlBar();

      // ── Table ──────────────────────────────────────────────────────────
      const tbl = document.createElement('table');
      Object.assign(tbl.style, { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' });

      // Sortable header
      const thead = tbl.createTHead();
      const hr    = thead.insertRow();
      COL_DEFS.forEach(({ key, label, align, width }) => {
        const th = document.createElement('th');
        Object.assign(th.style, {
          padding: '6px 8px', textAlign: align, width,
          background: '#ca5116', color: '#fff', border: '1px solid #b83d0a',
          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        });
        let indicator;
        if (key === 'semester' && sortCol === 'group') {
          indicator = '<span style="opacity:.75;font-size:.8em;margin-left:3px;">⊞</span>';
        } else if (sortCol === key) {
          indicator = `<span style="margin-left:3px;">${sortDir === 1 ? '▲' : '▼'}</span>`;
        } else {
          indicator = '<span style="opacity:.4;font-size:.8em;margin-left:3px;">↕</span>';
        }
        th.innerHTML = label + indicator;
        th.addEventListener('mouseenter', () => { th.style.background = '#b83d0a'; });
        th.addEventListener('mouseleave', () => { th.style.background = '#ca5116'; });
        th.addEventListener('click', () => {
          if (key === 'semester') {
            if      (sortCol === 'group')                            { sortCol = 'semester'; sortDir = 1;  }
            else if (sortCol === 'semester' && sortDir ===  1)      { sortDir = -1;                        }
            else if (sortCol === 'semester' && sortDir === -1)      { sortCol = 'group'; sortDir = 1;     }
            else                                                     { sortCol = 'semester'; sortDir = 1;  }
          } else {
            if (sortCol === key) sortDir *= -1;
            else { sortCol = key; sortDir = 1; }
          }
          render(improve);
        });
        hr.appendChild(th);
      });

      // Body
      const tb2 = tbl.createTBody();
      const data = getSortedData(modules, historical, sortCol, sortDir, showHistory);

      if (data.mode === 'grouped') {
        data.groups.forEach(([semLabel, group], gi) => {
          // Group header
          const gRow  = tb2.insertRow();
          const gCell = gRow.insertCell();
          gCell.colSpan = 4;
          gCell.textContent = semLabel;
          Object.assign(gCell.style, {
            background: '#dce8f5', color: '#115E67', fontWeight: 'bold', fontSize: '0.88em',
            padding: '4px 8px',
            borderTop:    gi > 0 ? '2px solid #ca5116' : '1px solid #dee2eb',
            borderBottom: '1px solid #dee2eb',
          });

          // Regular module rows
          group.items.forEach((m, i) => renderModuleRow(tb2, m, i, withImprovement));

          // Historical rows
          group.histItems.forEach((h, i) => renderHistoricalRow(tb2, h, i));

          // Semester summary (only if passed modules exist in this group)
          const passedInGroup = group.items.filter(m => !m.ongoing);
          if (passedInGroup.length > 0) {
            let wSum = 0, eSum = 0;
            for (const m of passedInGroup) {
              const g = (withImprovement && m.improvable) ? 1.0 : m.grade;
              wSum += g * m.ects;
              eSum += m.ects;
            }
            const avg = wSum / eSum;
            const sumRow  = tb2.insertRow();
            const sumCell = (col, html, right) => {
              const td = sumRow.insertCell();
              Object.assign(td.style, {
                padding: '3px 8px', border: '1px solid #c8d8e8',
                background: '#e8f0f8', fontSize: '0.82em',
                textAlign: right ? 'center' : 'left',
              });
              td.innerHTML = html;
              return td;
            };
            sumCell(0, `<span style="color:#115E67;font-weight:bold;">Ø Semester</span>`);
            sumCell(1, `<b style="color:${gradeColor(avg)}">${fmt(avg)}</b>`, true);
            sumCell(2, `<b>${eSum}</b>`, true);
            sumCell(3, '', true);
          }
        });
      } else {
        data.items.forEach((m, i) => renderModuleRow(tb2, m, i, withImprovement));
      }

      tableBox.innerHTML = '';
      tableBox.appendChild(tbl);

      // Best achievable
      const col = gradeColor(s.bestAchievable);
      bestBox.innerHTML = `
        🎯 <b>Bestm&ouml;glicher Notenschnitt</b>
        <span style="font-size:0.83em;color:#777;">&thinsp;(verbleibende${withImprovement
          ? ' + verbesserte' : ''} Module alle 1,0)</span>
        <span style="font-size:1.2em;font-weight:bold;color:${col};margin-left:8px;">
          &Oslash;&nbsp;${fmt(s.bestAchievable)}
        </span>`;
    }

    // ── Regular module row ────────────────────────────────────────────────
    function renderModuleRow(tb2, m, i, withImprovement) {
      const isImp     = withImprovement && m.improvable;
      const isOngoing = m.ongoing;
      const tr        = tb2.insertRow();

      if (isOngoing) {
        tr.style.background = i % 2 === 0 ? '#fafafa' : '#f3f3f3';
        tr.style.opacity    = '0.72';
        tr.style.fontStyle  = 'italic';
      } else {
        tr.style.background = isImp
            ? (i % 2 === 0 ? '#f0fff4' : '#e6f9eb')
            : (i % 2 === 0 ? '#fff'    : '#f2f5f9');
      }

      // Name
      const tdN = tr.insertCell();
      Object.assign(tdN.style, { padding: '4px 8px', border: '1px solid #dee2eb' });
      tdN.textContent = m.name;
      if (isOngoing) {
        tdN.appendChild(el('span', {
          marginLeft: '7px', fontSize: '0.75em', fontStyle: 'normal',
          background: '#e8f4f8', color: '#115E67',
          border: '1px solid #bee3f8', borderRadius: '3px', padding: '1px 5px',
          verticalAlign: 'middle',
        }, 'angemeldet'));
      }

      // Grade
      const tdG = tr.insertCell();
      Object.assign(tdG.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb',
        fontWeight: 'bold', whiteSpace: 'nowrap',
      });
      if (isOngoing) {
        tdG.innerHTML = '<span style="color:#aaa;font-weight:normal;">–</span>';
      } else {
        tdG.appendChild(el('span', { color: gradeColor(m.grade) }, fmt(m.grade)));
        if (isImp)
          tdG.appendChild(el('span', { color: '#298836', fontSize: '0.85em', fontWeight: 'normal' }, '\u00a0(1,00)'));
      }

      // ECTS
      const tdE = tr.insertCell();
      Object.assign(tdE.style, { padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb' });
      tdE.innerHTML = isOngoing ? '<span style="color:#aaa;">–</span>' : m.ects;

      // Semester
      const tdS = tr.insertCell();
      tdS.textContent = m.passedSem ?? '–';
      Object.assign(tdS.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb',
        fontSize: '0.82em', fontStyle: 'normal',
        color:      isImp     ? '#298836' : isOngoing ? '#115E67' : '#666',
        fontWeight: (isImp || isOngoing) ? 'bold' : 'normal',
      });
    }

    // ── Historical attempt row ────────────────────────────────────────────
    function renderHistoricalRow(tb2, h, i) {
      const tr = tb2.insertRow();
      tr.style.background = i % 2 === 0 ? '#fff8f0' : '#fff2e5';
      tr.style.opacity    = '0.85';

      // Name + reason badge
      const tdN = tr.insertCell();
      Object.assign(tdN.style, { padding: '4px 8px', border: '1px solid #f0d8c8', fontStyle: 'italic' });
      tdN.textContent = h.moduleName;
      const badgeColor = h.subStatus === 'NB' || h.subStatus === 'EN' ? '#A50034' : '#ca5116';
      tdN.appendChild(el('span', {
        marginLeft: '7px', fontSize: '0.75em', fontStyle: 'normal',
        background: badgeColor + '18', color: badgeColor,
        border: `1px solid ${badgeColor}55`, borderRadius: '3px', padding: '1px 5px',
        verticalAlign: 'middle', whiteSpace: 'nowrap',
      }, h.reasonLabel));

      // Grade
      const tdG = tr.insertCell();
      Object.assign(tdG.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #f0d8c8',
        fontWeight: 'bold', whiteSpace: 'nowrap',
      });
      if (h.grade !== null) {
        tdG.appendChild(el('span', { color: gradeColor(h.grade) }, fmt(h.grade)));
      } else {
        tdG.innerHTML = '<span style="color:#bbb;font-weight:normal;">–</span>';
      }

      // ECTS
      const tdE = tr.insertCell();
      Object.assign(tdE.style, { padding: '4px 8px', textAlign: 'center', border: '1px solid #f0d8c8' });
      tdE.innerHTML = '<span style="color:#bbb;">0</span>';

      // Semester
      const tdS = tr.insertCell();
      tdS.textContent = h.semester ?? '–';
      Object.assign(tdS.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #f0d8c8',
        fontSize: '0.82em', color: '#999',
      });
    }

    // ── Wire controls ─────────────────────────────────────────────────────

    // Improvement toggle
    const inp   = wrap.querySelector('#qp-imp');
    const track = wrap.querySelector('#qp-track');
    const knob  = wrap.querySelector('#qp-knob');

    function applyImpToggle(on) {
      inp.checked            = on;
      track.style.background = on ? '#298836' : '#ccc';
      knob.style.transform   = on ? 'translateX(18px)' : 'translateX(0)';
    }

    chrome.storage.local.get([IMPROVE_KEY, HISTORY_KEY], (res) => {
      improve     = res[IMPROVE_KEY]  === true;
      showHistory = res[HISTORY_KEY]  === true;
      applyImpToggle(improve);
      render(improve);
    });

    inp.addEventListener('change', () => {
      const on = inp.checked;
      applyImpToggle(on);
      chrome.storage.local.set({ [IMPROVE_KEY]: on });
      render(on);
    });

    // Reset sort button
    btnResetSort.addEventListener('click', () => {
      if (sortCol === 'group' && sortDir === 1) return;
      sortCol = 'group';
      sortDir = 1;
      render(improve);
    });

    // History toggle button
    btnHistory.addEventListener('click', () => {
      if (sortCol !== 'group') return; // disabled in sort mode
      showHistory = !showHistory;
      chrome.storage.local.set({ [HISTORY_KEY]: showHistory });
      render(improve);
    });

    return wrap;
  }

  // ─── 8. Global visibility ─────────────────────────────────────────────────

  function setVisible(enabled) {
    const w = document.getElementById(WIDGET_ID);
    if (w) w.style.display = enabled ? 'block' : 'none';
  }

  // ─── 9. Boot ──────────────────────────────────────────────────────────────

  const isNotenspiegelPage =
      location.href.includes('state=notenspiegelStudent') ||
      document.querySelector('.content h1')?.textContent.trim() === 'Notenspiegel';

  if (!isNotenspiegelPage) return;

  const { modules, historical, currentSem } = parseModules();
  const widget = buildWidget(modules, historical, currentSem);

  const h1 = document.querySelector('.content h1');
  if (h1) h1.insertAdjacentElement('afterend', widget);
  else    document.body.prepend(widget);

  chrome.storage.local.get(ENABLED_KEY, (res) => {
    setVisible(res[ENABLED_KEY] !== false);
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'qisplus_toggle') setVisible(msg.enabled);
  });
})();