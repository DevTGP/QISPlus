(function () {
  'use strict';

  const ENABLED_KEY = 'qisplus_enabled';
  const WIDGET_ID   = 'qisplus-widget';

  // ─── 1. Parse grades from the original, unmodified table ────────────────────

  function parseModules() {
    // The grade table is the second <table> on the page
    const tables = document.getElementsByTagName('table');
    if (tables.length < 2) return [];

    const tbody = tables[1].tBodies[0] ?? tables[1].children[0];
    const modules = [];

    for (const row of tbody.rows) {
      const cells = row.cells;
      if (!cells.length) continue;

      // Module-header rows: first cell has class "qis_konto" AND
      // second cell has colspan="2" (category rows like "Pflichtmodule" also
      // use qis_konto but do NOT start with "Modul:")
      const firstClass = cells[0].className.trim();
      if (firstClass !== 'qis_konto') continue;
      if (cells[1]?.getAttribute('colspan') !== '2') continue;

      const nameRaw = cells[1].textContent.trim();
      if (!nameRaw.startsWith('Modul:')) continue; // skip group headers

      const name      = nameRaw.replace(/^Modul:\s*/, '');
      const gradeText = cells[2]?.textContent.trim().replace(',', '.');
      const status    = cells[3]?.textContent.trim();
      const ectsText  = cells[4]?.textContent.trim();

      const grade = parseFloat(gradeText);
      const ects  = parseInt(ectsText, 10);

      // Only include passed modules with a numeric grade
      if (status === 'BE' && !isNaN(grade) && !isNaN(ects) && ects > 0) {
        modules.push({ name, grade, ects });
      }
    }

    return modules;
  }

  // ─── 2. Compute weighted average ────────────────────────────────────────────

  function calcStats(modules) {
    let totalEcts = 0;
    let weightedSum = 0;
    for (const m of modules) {
      weightedSum += m.grade * m.ects;
      totalEcts   += m.ects;
    }
    const avg = totalEcts > 0
      ? Math.round((weightedSum / totalEcts) * 100) / 100
      : null;
    return { avg, totalEcts };
  }

  // ─── 3. Build the new widget (original DOM is never touched) ────────────────

  function gradeColor(g) {
    if (g <= 1.5) return '#298836';
    if (g <= 2.5) return '#115E67';
    if (g <= 3.5) return '#ca5116';
    return '#A50034';
  }

  function fmt(grade) {
    return grade.toFixed(1).replace('.', ',');
  }

  function createWidget(modules) {
    const { avg, totalEcts } = calcStats(modules);

    const wrap = document.createElement('div');
    wrap.id = WIDGET_ID;
    Object.assign(wrap.style, {
      margin: '0 0 20px 0',
      padding: '16px',
      background: '#f7fbff',
      border: '2px solid #ca5116',
      borderRadius: '6px',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      lineHeight: '1.4',
    });

    // ── Header ──
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '14px',
    });

    const title = document.createElement('span');
    title.textContent = '📊 QISPlus – Notenübersicht';
    Object.assign(title.style, { fontWeight: 'bold', fontSize: '1.05em', color: '#ca5116' });

    header.appendChild(title);
    wrap.appendChild(header);

    // ── Summary badges ──
    if (avg !== null) {
      const badges = document.createElement('div');
      Object.assign(badges.style, { display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' });

      const badgeStyle = (bg) => ({
        background: bg,
        color: '#fff',
        padding: '6px 14px',
        borderRadius: '4px',
        fontSize: '1.2em',
        fontWeight: 'bold',
      });

      const avgBadge = document.createElement('span');
      avgBadge.textContent = `Ø ${fmt(avg)}`;
      Object.assign(avgBadge.style, badgeStyle('#ca5116'));

      const ectsBadge = document.createElement('span');
      ectsBadge.textContent = `${totalEcts} ECTS`;
      Object.assign(ectsBadge.style, badgeStyle('#115E67'));

      badges.append(avgBadge, ectsBadge);
      wrap.appendChild(badges);
    }

    if (modules.length === 0) {
      const empty = document.createElement('p');
      empty.textContent = 'Noch keine bestandenen Module gefunden.';
      empty.style.color = '#888';
      wrap.appendChild(empty);
      return wrap;
    }

    // ── Module table ──
    const table = document.createElement('table');
    Object.assign(table.style, {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '0.92em',
    });

    // thead
    const thead = table.createTHead();
    const hrow  = thead.insertRow();
    [['Modul', 'left'], ['Note', 'center'], ['ECTS', 'center']].forEach(([text, align]) => {
      const th = document.createElement('th');
      th.textContent = text;
      Object.assign(th.style, {
        padding: '5px 8px',
        textAlign: align,
        background: '#ca5116',
        color: '#fff',
        fontWeight: 'bold',
        border: '1px solid #c04010',
      });
      hrow.appendChild(th);
    });

    // tbody
    const tbody = table.createTBody();
    modules.forEach((m, i) => {
      const tr = tbody.insertRow();
      tr.style.background = i % 2 === 0 ? '#fff' : '#f2f5f9';

      const tdName = tr.insertCell();
      tdName.textContent = m.name;
      Object.assign(tdName.style, { padding: '4px 8px', border: '1px solid #dee2eb' });

      const tdGrade = tr.insertCell();
      tdGrade.textContent = fmt(m.grade);
      Object.assign(tdGrade.style, {
        padding: '4px 8px',
        textAlign: 'center',
        border: '1px solid #dee2eb',
        fontWeight: 'bold',
        color: gradeColor(m.grade),
      });

      const tdEcts = tr.insertCell();
      tdEcts.textContent = m.ects;
      Object.assign(tdEcts.style, { padding: '4px 8px', textAlign: 'center', border: '1px solid #dee2eb' });
    });

    wrap.appendChild(table);
    return wrap;
  }

  // ─── 4. Insert widget before the original content ───────────────────────────

  function insertWidget(widget) {
    // Find the <h1>Notenspiegel</h1> and insert right after it
    const contentDiv = document.querySelector('.content');
    const h1 = contentDiv?.querySelector('h1');
    if (h1) {
      h1.insertAdjacentElement('afterend', widget);
    } else {
      // Fallback: prepend to body
      document.body.prepend(widget);
    }
  }

  // ─── 5. Show / hide ─────────────────────────────────────────────────────────

  function setVisible(enabled) {
    const w = document.getElementById(WIDGET_ID);
    if (w) w.style.display = enabled ? 'block' : 'none';
  }

  // ─── 6. Boot ────────────────────────────────────────────────────────────────

  const modules = parseModules();
  const widget  = createWidget(modules);
  insertWidget(widget);

  // Apply stored preference
  chrome.storage.local.get(ENABLED_KEY, (result) => {
    const enabled = result[ENABLED_KEY] !== false; // default on
    setVisible(enabled);
  });

  // Listen for toggle messages from popup.js
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'qisplus_toggle') {
      setVisible(msg.enabled);
    }
  });
})();
