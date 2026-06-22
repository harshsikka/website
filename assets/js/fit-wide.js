/* Keep wide, non-reflowable artifacts from widening the page on narrow screens.
 *
 *  - Fixed-width diagrams (.mpd-wrap): SCALE the whole thing down to fit the
 *    column (proportional shrink — keeps shape instead of squishing). Responsive
 *    grid components (e.g. .rpt-series, which uses an auto-fill grid) are left
 *    alone — forcing max-content on them changes their column count.
 *  - Math (.katex), code (<pre>), embeds: wrap in a horizontal SCROLL box so the
 *    artifact scrolls inside itself rather than forcing a whole-page side-scroll.
 *  - Charts (<canvas>): wrapped in a horizontal SCROLL box too. The charts render
 *    at a fixed legible width (so text + value labels stay readable); on narrow
 *    screens they scroll instead of shrinking to an unreadable size.
 *
 * Only elements that actually overflow are touched; inline math and text are
 * left alone. Re-runs on resize. Self-guards on missing content. */
(function () {
    'use strict';
    var content = document.querySelector('.gh-content');
    if (!content) return;

    function scaleToFit(el) {
        // Ensure a wrapper that reserves the scaled height and clips overflow.
        var wrap = el.parentNode && el.parentNode.classList &&
            el.parentNode.classList.contains('fig-scale') ? el.parentNode : null;
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'fig-scale';
            el.parentNode.insertBefore(wrap, el);
            wrap.appendChild(el);
        }
        // Measure natural size (let the diagram lay out at its content width).
        el.style.transform = 'none';
        el.style.transformOrigin = 'top left';
        el.style.width = 'max-content';
        el.style.maxWidth = 'none';
        var natW = el.offsetWidth;
        var natH = el.offsetHeight;
        var avail = wrap.clientWidth;
        if (!natW || natW <= avail + 1) {           // already fits — reset
            el.style.width = '';
            el.style.maxWidth = '';
            el.style.transform = '';
            wrap.style.height = '';
            return;
        }
        var s = avail / natW;
        el.style.transform = 'scale(' + s + ')';
        wrap.style.height = Math.ceil(natH * s) + 'px';   // reserve scaled height
    }

    function scrollWrap(el, max) {
        if (el.closest('.fig-scroll-x')) return;
        if (el.getBoundingClientRect().width <= max + 1) return;  // fits — leave it
        var w = document.createElement('span');                   // valid inside <p>
        w.className = 'fig-scroll-x';
        el.parentNode.insertBefore(w, el);
        w.appendChild(el);
    }

    // Put each chart canvas in its own horizontal-scroll box (once). The chart
    // draws itself at a fixed legible width; this lets it scroll on narrow
    // screens rather than being shrunk to an unreadable size.
    function chartWrap(el) {
        if (el.closest('.fig-chart-scroll') || el.closest('.fig-zoom')) return;
        var w = document.createElement('div');
        w.className = 'fig-chart-scroll';
        el.parentNode.insertBefore(w, el);
        w.appendChild(el);
    }

    function run() {
        var max = content.clientWidth;
        if (!max) return;
        Array.prototype.forEach.call(content.querySelectorAll('canvas'), chartWrap);
        Array.prototype.forEach.call(content.querySelectorAll('.mpd-wrap, .katex-display'), scaleToFit);
        Array.prototype.forEach.call(content.querySelectorAll('pre, .kg-embed-card'),
            function (el) { scrollWrap(el, max); });
    }

    run();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', run);   // fonts/KaTeX can change widths after load
    var t;
    window.addEventListener('resize', function () {
        clearTimeout(t);
        t = setTimeout(run, 150);
    }, { passive: true });
})();
