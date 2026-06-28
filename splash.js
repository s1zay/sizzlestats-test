// ==========================================
// SIZZLESTATS SPLASH PAGE LOGIC (V2.0 Launcher)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tell the browser to stop auto-scrolling on refresh
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // 2. Snap instantly to the absolute top of the page
    window.scrollTo(0, 0);
});
