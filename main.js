(function () {
  'use strict';

  const ENABLED_KEY  = 'qisplus_enabled';
  const IMPROVE_KEY  = 'qisplus_improve';
  const WIDGET_ID    = 'qisplus-widget';
  const TOTAL_ECTS   = 180;

  // ─── 1. Parse passed modules + which semester they were passed in ──────────

  function semToNum(s) {
    // WiSe 25/26 → 2025.5   SoSe 25 → 2025.0   WiSe 24/25 → 2024.5
    const wise = s.match(/WiSe\s+(\d{2})\/\d{2}/);
    const sose = s.match(/SoSe\s+(\d{2,4})/);
    if (wise) return 2000 + parseInt(wise[1], 10) + 0.5;
    if (sose) { const y = parseInt(sose[1], 10); return y < 100 ? 2000 + y : y; }
    return 0;
  }

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

      // ── Module-header row ──
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
        } else {
          cur = null;
        }
        continue;
      }

      // ── Exam sub-row ──
      if (fc === 'ns_tabelle1_alignleft' && cur) {
        const subStatus = cells[4]?.textContent.trim();
        const subSem    = cells[2]?.textContent.trim();
        const subGrade  = parseFloat(cells[3]?.textContent.trim().replace(',', '.'));
        const semNum    = semToNum(subSem);

        // Track the most recent passing attempt for this module
        if (subStatus === 'BE' && !isNaN(subGrade) && subGrade > 0 && semNum > cur.passedSemNum) {
          cur.passedSemNum = semNum;
          cur.passedSem    = subSem;
        }
      }
    }

    return result;
  }

  // ─── 2. Mark modules from the last completed semester as improvable ────────

  function markImprovable(modules) {
    const maxSem = Math.max(...modules.map(m => m.passedSemNum));
    modules.forEach(m => { m.improvable = (m.passedSemNum === maxSem); });
    return modules.find(m => m.passedSemNum === maxSem)?.passedSem ?? '';
  }

  // ─── 3. Statistics ────────────────────────────────────────────────────────

  function calcStats(modules, withImprovement) {
    let earnedEcts  = 0;
    let weightedSum = 0;

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
      earnedEcts,
      remaining,
    };
  }

  function round2(n) { return Math.round(n * 100) / 100; }

  // ─── 4. Helpers ──────────────────────────────────────────────────────────

  function gradeColor(g) {
    if (g <= 1.5) return '#298836';
    if (g <= 2.5) return '#115E67';
    if (g <= 3.5) return '#ca5116';
    return '#A50034';
  }

  function fmt(g) { return g.toFixed(1).replace('.', ','); }

  function el(tag, styles, html) {
    const e = document.createElement(tag);
    if (styles)          Object.assign(e.style, styles);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  // ─── 5. Build widget ─────────────────────────────────────────────────────

  function buildWidget(modules) {
    const lastSemLabel    = markImprovable(modules);
    const improvableCount = modules.filter(m => m.improvable).length;

    // ── Outer wrapper ──
    const wrap = el('div', {
      margin: '0 0 20px', padding: '16px',
      background: '#f7fbff', border: '2px solid #ca5116',
      borderRadius: '6px', fontFamily: 'sans-serif', fontSize: '14px', lineHeight: '1.5',
    });
    wrap.id = WIDGET_ID;

    // ── Title ──
    wrap.appendChild(el('div',
      { fontWeight: 'bold', fontSize: '1.05em', color: '#ca5116', marginBottom: '14px' },
      '📊 QISPlus – Notenübersicht'));

    // ── Progress bar placeholder ──
    const progressBox = el('div', { marginBottom: '14px' });
    wrap.appendChild(progressBox);

    // ── Badges row placeholder ──
    const badgesBox = el('div', { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' });
    wrap.appendChild(badgesBox);

    // ── Improvement toggle ──
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
      </label>
    `;
    wrap.appendChild(toggleBar);

    // ── Module table placeholder ──
    const tableBox = el('div', {});
    wrap.appendChild(tableBox);

    // ── Best achievable row placeholder ──
    const bestBox = el('div', {
      marginTop: '12px', padding: '8px 12px',
      background: '#fff8e1', borderRadius: '4px', border: '1px solid #ffe082',
    });
    wrap.appendChild(bestBox);

    // ── Render ──────────────────────────────────────────────────────────────

    function render(withImprovement) {
      const s   = calcStats(modules, withImprovement);
      const pct = Math.min(100, Math.round((s.earnedEcts / TOTAL_ECTS) * 100));

      // Progress bar
      progressBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:0.84em;color:#555;margin-bottom:4px;">
          <span><b>${s.earnedEcts}</b> / ${TOTAL_ECTS} ECTS erreicht</span>
          <span><b>${s.remaining}</b> verbleibend &middot; ${pct}\u202f%</span>
        </div>
        <div style="height:10px;background:#e0e0e0;border-radius:5px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ca5116,#e07040);
            border-radius:5px;transition:width .4s;"></div>
        </div>`;

      // Badges
      badgesBox.innerHTML = '';
      const badge = (text, bg) => el('span', {
        background: bg, color: '#fff', padding: '6px 14px',
        borderRadius: '4px', fontWeight: 'bold', fontSize: '1.1em',
      }, text);
      if (s.currentAvg !== null)
        badgesBox.appendChild(badge(`\u00d8\u00a0aktuell:\u00a0${fmt(s.currentAvg)}`, '#ca5116'));
      badgesBox.appendChild(badge(`${s.earnedEcts}\u00a0ECTS`, '#115E67'));

      // Module table
      const tbl = document.createElement('table');
      Object.assign(tbl.style, { width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' });

      const thead = tbl.createTHead();
      const hr    = thead.insertRow();
      [['Modul','left','42%'],['Note','center','12%'],['ECTS','center','8%'],['Semester','center','14%']]
        .forEach(([t, a, w]) => {
          const th = document.createElement('th');
          th.textContent = t;
          Object.assign(th.style, { padding:'5px 8px', textAlign:a, width:w,
            background:'#ca5116', color:'#fff', border:'1px solid #c04010' });
          hr.appendChild(th);
        });

      const tb2 = tbl.createTBody();
      modules.forEach((m, i) => {
        const isImp = withImprovement && m.improvable;
        const tr    = tb2.insertRow();
        tr.style.background = isImp
          ? (i % 2 === 0 ? '#f0fff4' : '#e6f9eb')
          : (i % 2 === 0 ? '#fff'    : '#f2f5f9');

        // Name
        const tdN = tr.insertCell();
        tdN.textContent = m.name;
        Object.assign(tdN.style, { padding:'4px 8px', border:'1px solid #dee2eb' });

        // Grade
        const tdG = tr.insertCell();
        Object.assign(tdG.style, {
          padding:'4px 8px', textAlign:'center', border:'1px solid #dee2eb',
          fontWeight:'bold', whiteSpace:'nowrap',
        });
        tdG.appendChild(el('span', { color: gradeColor(m.grade) }, fmt(m.grade)));
        if (isImp) {
          tdG.appendChild(el('span',
            { color:'#298836', fontSize:'0.85em', fontWeight:'normal' },
            '\u00a0(1,0)'));
        }

        // ECTS
        const tdE = tr.insertCell();
        tdE.textContent = m.ects;
        Object.assign(tdE.style, { padding:'4px 8px', textAlign:'center', border:'1px solid #dee2eb' });

        // Semester
        const tdS = tr.insertCell();
        tdS.textContent = m.passedSem ?? '–';
        Object.assign(tdS.style, {
          padding:'4px 8px', textAlign:'center', border:'1px solid #dee2eb',
          fontSize:'0.82em',
          color:      isImp ? '#298836' : '#666',
          fontWeight: isImp ? 'bold'    : 'normal',
        });
      });

      tableBox.innerHTML = '';
      tableBox.appendChild(tbl);

      // Best achievable
      const col = gradeColor(s.bestAchievable);
      bestBox.innerHTML = `
        🎯 <b>Bestm&ouml;glicher Notenschnitt</b>
        <span style="font-size:0.83em;color:#777;">&thinsp;(verbleibende${withImprovement
          ? ' + verbesserte' : ''} Module alle\u00a01,0)</span>
        <span style="font-size:1.2em;font-weight:bold;color:${col};margin-left:8px;">
          &Oslash;\u00a0${fmt(s.bestAchievable)}
        </span>`;
    }

    // ── Wire improvement toggle ──────────────────────────────────────────────
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

  // ─── 6. Global visibility (from popup toggle) ────────────────────────────

  function setVisible(enabled) {
    const w = document.getElementById(WIDGET_ID);
    if (w) w.style.display = enabled ? 'block' : 'none';
  }

  // ─── 7. Boot ─────────────────────────────────────────────────────────────

  const modules = parseModules();
  const widget  = buildWidget(modules);

  // Insert right after <h1> — original table is never modified
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
