// QISPlus – content script entry point (classic script, no top-level import)
// Chrome MV3 content scripts cannot use static ES module imports.
// Dynamic import() with chrome.runtime.getURL() works correctly and loads
// the full ES module graph from the extension's own origin.

(async function () {
    'use strict';

    const ENABLED_KEY = 'qisplus_enabled';
    const WIDGET_ID = 'qisplus-widget';

    // ------------------------------------------------------------------
    // Guard 1: only run on the Notenspiegel page
    // ------------------------------------------------------------------
    const onNotenspiegel =
        location.href.includes('state=notenspiegelStudent') ||
        document.querySelector('.content h1')?.textContent.trim() === 'Notenspiegel';

    if (!onNotenspiegel) return;

    // ------------------------------------------------------------------
    // Guard 2: prevent duplicate widgets
    // ------------------------------------------------------------------
    if (document.getElementById(WIDGET_ID)) return;

    // ------------------------------------------------------------------
    // Dynamically load ES modules from the extension origin.
    // Relative imports inside those modules resolve correctly on their own.
    // ------------------------------------------------------------------
    const base = chrome.runtime.getURL('src/');

    const [{parseGrades}, {buildWidget}, {injectThemeStyles}] = await Promise.all([
        import(base + 'parser.js'),
        import(base + 'widget.js'),
        import(base + 'render/theme.js'),
    ]);

    // Inject the theme stylesheet ASAP so the widget renders with the
    // correct palette on first paint (no flash of unthemed widget).
    injectThemeStyles();

    // ------------------------------------------------------------------
    // Boot
    // ------------------------------------------------------------------
    const parseResult = parseGrades();
    const widget = buildWidget(parseResult);

    const h1 = document.querySelector('.content h1');
    if (h1) {
        h1.insertAdjacentElement('afterend', widget);
    } else {
        document.body.prepend(widget);
    }

    // ------------------------------------------------------------------
    // Enable / disable from popup
    // ------------------------------------------------------------------
    function setVisible(on) {
        const w = document.getElementById(WIDGET_ID);
        if (w) w.style.display = on ? 'block' : 'none';
    }

    chrome.storage.local.get(ENABLED_KEY, res => {
        setVisible(res[ENABLED_KEY] !== false);
    });

    chrome.runtime.onMessage.addListener(msg => {
        if (msg.type === 'qisplus_toggle') setVisible(msg.enabled);
    });
})();