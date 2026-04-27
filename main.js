(function () {
  'use strict';

  const ENABLED_KEY = 'qisplus_enabled';
  const IMPROVE_KEY = 'qisplus_improve';
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

  // ─── 2. Parse passed modules ──────────────────────────────────────────────

  function parseModules() {
    const tables = document.getElementsByTagName('table');
    if (tables.length < 2) return [];
    const tbody = tables[1].tBodies[0] ?? tables[1].children[0];
    const result = [];
    let cur = null;

    for (const row of tbody.rows) {
      const cells = row.cells;
      if (!cells.length) continue;
      const fc = cells[0].className.trim();

      if (fc === 'qis_konto' && cells[1]?.getAttribute('colspan') === '2') {
        const raw = cells[1].textContent.trim();
        if (!raw.startsWith('Modul:')) { cur = null; continue; }
        const grade  = parseFloat(cells[2]?.textContent.trim().replace(',', '.'));
        const status = cells[3]?.textContent.trim();
        const ects   = parseInt(cells[4]?.textContent.trim(), 10);
        const name   = raw.replace(/^Modul:\s*/, '');
        if (status === 'BE' && !isNaN(grade) && !isNaN(ects) && ects > 0) {
          cur = { name, grade, ects, passedSem: null, passedSemNum: 0 };
          result.push(cur);
        } else { cur = null; }
        continue;
      }

      if (fc === 'ns_tabelle1_alignleft' && cur) {
        const subStatus = cells[4]?.textContent.trim();
        const subSem    = cells[2]?.textContent.trim();
        const subGrade  = parseFloat(cells[3]?.textContent.trim().replace(',', '.'));
        const semNum    = semToNum(subSem);
        if (subStatus === 'BE' && !isNaN(subGrade) && subGrade > 0 && semNum > cur.passedSemNum) {
          cur.passedSemNum = semNum;
          cur.passedSem    = subSem;
        }
      }
    }
    return result;
  }

  // ─── 3. Mark improvable modules (last completed semester) ─────────────────

  function markImprovable(modules) {
    const maxSem = Math.max(...modules.map(m => m.passedSemNum));
    modules.forEach(m => { m.improvable = (m.passedSemNum === maxSem); });
    return modules.find(m => m.passedSemNum === maxSem)?.passedSem ?? '';
  }

  // ─── 4. Statistics ────────────────────────────────────────────────────────

  function calcStats(modules, withImprovement) {
    let earnedEcts = 0, weightedSum = 0;
    for (const m of modules) {
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

  // sortCol: 'group' | 'name' | 'grade' | 'ects' | 'semester'
  // sortDir: 1 (asc) | -1 (desc)

  function getSortedData(modules, sortCol, sortDir) {
    if (sortCol === 'group') {
      // Group by semester chronologically, alpha within
      const map = new Map();
      for (const m of modules) {
        const key = m.passedSem ?? '–';
        if (!map.has(key)) map.set(key, { semNum: m.passedSemNum, items: [] });
        map.get(key).items.push(m);
      }
      const groups = [...map.entries()]
        .sort(([, a], [, b]) => a.semNum - b.semNum);
      groups.forEach(([, g]) => g.items.sort((a, b) => a.name.localeCompare(b.name, 'de')));
      return { mode: 'grouped', groups };
    }

    // Flat sort
    const sorted = [...modules].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case 'name':     cmp = a.name.localeCompare(b.name, 'de'); break;
        case 'grade':    cmp = a.grade - b.grade;                  break;
        case 'ects':     cmp = a.ects  - b.ects;                   break;
        case 'semester': cmp = a.passedSemNum - b.passedSemNum;    break;
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
  function fmt(g) { return g.toFixed(1).replace('.', ','); }
  function el(tag, styles, html) {
    const e = document.createElement(tag);
    if (styles) Object.assign(e.style, styles);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // ─── 7. Build widget ──────────────────────────────────────────────────────

  function buildWidget(modules) {
    const lastSemLabel    = markImprovable(modules);
    const improvableCount = modules.filter(m => m.improvable).length;

    // Mutable render state
    let sortCol = 'group';
    let sortDir = 1;
    let improve = false;

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

    // Improvement toggle
    const toggleBar = el('div', {
      display: 'flex', alignItems: 'center', gap: '10px',
      marginBottom: '14px', padding: '8px 12px',
      background: '#e8f4f8', borderRadius: '4px', border: '1px solid #bee3f8',
    });
    toggleBar.innerHTML = `
      <span style="font-weight:bold;font-size:0.9em;color:#333;">Notenverbesserung</span>
      <span style="font-size:0.82em;color:#666;">${lastSemLabel} &middot; ${improvableCount} Module</span>
      <label style="position:relative;width:42px;height:24px;flex-shrink:0;margin-left:auto;cursor:pointer;">
        <input id="qp-imp" type="checkbox" style="display:none;">
        <span id="qp-track" style="position:absolute;inset:0;background:#ccc;border-radius:24px;transition:background .25s;"></span>
        <span id="qp-knob"  style="position:absolute;top:3px;left:3px;width:18px;height:18px;
          background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.25);
          transition:transform .25s;pointer-events:none;"></span>
      </label>`;
    wrap.appendChild(toggleBar);

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

      // ── Table ──────────────────────────────────────────────────────────
      const tbl  = document.createElement('table');
      Object.assign(tbl.style, { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' });

      // Thead with sortable headers
      const thead = tbl.createTHead();
      const hr    = thead.insertRow();

      COL_DEFS.forEach(({ key, label, align, width }) => {
        const th = document.createElement('th');
        Object.assign(th.style, {
          padding: '6px 8px', textAlign: align, width,
          background: '#ca5116', color: '#fff', border: '1px solid #b83d0a',
          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        });

        // Sort indicator
        let indicator;
        if (key === 'semester' && sortCol === 'group') {
          indicator = '<span style="opacity:.75;font-size:.8em;margin-left:3px;">⊞</span>';
        } else if (sortCol === key) {
          indicator = `<span style="margin-left:3px;">${sortDir === 1 ? '▲' : '▼'}</span>`;
        } else {
          indicator = '<span style="opacity:.4;font-size:.8em;margin-left:3px;">↕</span>';
        }
        th.innerHTML = label + indicator;

        // Hover highlight
        th.addEventListener('mouseenter', () => { th.style.background = '#b83d0a'; });
        th.addEventListener('mouseleave', () => { th.style.background = '#ca5116'; });

        // Click handler
        th.addEventListener('click', () => {
          if (key === 'semester') {
            // Cycle: group → sem↑ → sem↓ → group
            if (sortCol === 'group')                  { sortCol = 'semester'; sortDir = 1;  }
            else if (sortCol === 'semester' && sortDir === 1)  { sortDir = -1;               }
            else if (sortCol === 'semester' && sortDir === -1) { sortCol = 'group'; sortDir = 1; }
            else                                       { sortCol = 'semester'; sortDir = 1;  }
          } else {
            if (sortCol === key) { sortDir *= -1; }
            else                 { sortCol = key; sortDir = 1; }
          }
          render(improve);
        });

        hr.appendChild(th);
      });

      // Tbody
      const tb2  = tbl.createTBody();
      const data = getSortedData(modules, sortCol, sortDir);

      if (data.mode === 'grouped') {
        data.groups.forEach(([semLabel, group], gi) => {
          // Semester group header row
          const gRow  = tb2.insertRow();
          const gCell = gRow.insertCell();
          gCell.colSpan = 4;
          gCell.textContent = semLabel;
          Object.assign(gCell.style, {
            background: '#dce8f5', color: '#115E67',
            fontWeight: 'bold', fontSize: '0.88em',
            padding: '4px 8px',
            borderTop: gi > 0 ? '2px solid #ca5116' : '1px solid #dee2eb',
            borderBottom: '1px solid #dee2eb',
          });

          // Module rows within group
          group.items.forEach((m, i) => {
            renderModuleRow(tb2, m, i, withImprovement);
          });
        });
      } else {
        data.items.forEach((m, i) => {
          renderModuleRow(tb2, m, i, withImprovement);
        });
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

    // ── Module row renderer ───────────────────────────────────────────────
    function renderModuleRow(tb2, m, i, withImprovement) {
      const isImp = withImprovement && m.improvable;
      const tr    = tb2.insertRow();
      tr.style.background = isImp
        ? (i % 2 === 0 ? '#f0fff4' : '#e6f9eb')
        : (i % 2 === 0 ? '#fff'    : '#f2f5f9');

      const tdN = tr.insertCell();
      tdN.textContent = m.name;
      Object.assign(tdN.style, { padding: '4px 8px', border: '1px solid #dee2eb' });

      const tdG = tr.insertCell();
      Object.assign(tdG.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb',
        fontWeight: 'bold', whiteSpace: 'nowrap',
      });
      const gSpan = el('span', { color: gradeColor(m.grade) }, fmt(m.grade));
      tdG.appendChild(gSpan);
      if (isImp) {
        tdG.appendChild(el('span',
          { color: '#298836', fontSize: '0.85em', fontWeight: 'normal' },
          '\u00a0(1,0)'));
      }

      const tdE = tr.insertCell();
      tdE.textContent = m.ects;
      Object.assign(tdE.style, { padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb' });

      const tdS = tr.insertCell();
      tdS.textContent = m.passedSem ?? '–';
      Object.assign(tdS.style, {
        padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb',
        fontSize: '0.82em',
        color:      isImp ? '#298836' : '#666',
        fontWeight: isImp ? 'bold'    : 'normal',
      });
    }

    // ── Wire improvement toggle ───────────────────────────────────────────
    const inp   = wrap.querySelector('#qp-imp');
    const track = wrap.querySelector('#qp-track');
    const knob  = wrap.querySelector('#qp-knob');

    function applyToggle(on) {
      inp.checked            = on;
      track.style.background = on ? '#298836' : '#ccc';
      knob.style.transform   = on ? 'translateX(18px)' : 'translateX(0)';
    }

    chrome.storage.local.get(IMPROVE_KEY, (res) => {
      const on = res[IMPROVE_KEY] === true;
      applyToggle(on);
      render(on);
    });

    inp.addEventListener('change', () => {
      const on = inp.checked;
      applyToggle(on);
      chrome.storage.local.set({ [IMPROVE_KEY]: on });
      render(on);
    });

    return wrap;
  }

  // ─── 8. Global visibility ─────────────────────────────────────────────────

  function setVisible(enabled) {
    const w = document.getElementById(WIDGET_ID);
    if (w) w.style.display = enabled ? 'block' : 'none';
  }

  // ─── 9. Boot ──────────────────────────────────────────────────────────────

  const modules = parseModules();
  const widget  = buildWidget(modules);

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