/* Click/tap-to-expand for charts, diagrams, formulas, and images — standard
 * image-lightbox behaviour.
 *
 *  - Opens fit-to-screen (whole artifact visible, centered).
 *  - Click the artifact toggles to actual size; when bigger than the viewport it
 *    scrolls/pans. Click again returns to fit. (zoom-in / zoom-out cursor.)
 *  - Click the backdrop or the × (or press Esc) to close.
 *
 * Charts (<canvas>) are snapshotted to an <img> for the overlay, so they zoom
 * crisply at their hi-DPI backing and the live chart never redraws or distorts.
 * Plain images are shown directly; non-reflowing diagrams are scaled to fit and
 * shown at natural size when zoomed. The backdrop takes on the artifact's
 * dominant colour. Ghost-native images are left to PhotoSwipe. Works at all
 * widths. */
(function () {
    'use strict';
    var content = document.querySelector('.gh-content');
    if (!content) return;

    var overlay = document.createElement('div');
    overlay.className = 'fig-zoom';
    overlay.innerHTML = '<button type="button" class="fig-zoom__close" aria-label="Close">×</button><div class="fig-zoom__inner"></div>';
    var inner = overlay.querySelector('.fig-zoom__inner');
    document.body.appendChild(overlay);

    var el = null;             // element currently shown in the overlay
    var media = false;         // true when el is an <img> we created (snapshot/clone)
    var placeholder = null, savedStyle = null;   // restore info for moved (diagram) elements
    var zoomed = false;

    // Ambient backdrop: tint the overlay with the artifact's dominant colour so
    // it blends in instead of sitting on a hard black border. Sampled from the
    // pixels (composited over white, matching how it's shown). Returns [r,g,b]
    // or null (non-pixel element, or a cross-origin/tainted image).
    function dominantColor(node) {
        if (node.tagName !== 'IMG' && node.tagName !== 'CANVAS') return null;
        try {
            var w = 28, h = 28;
            var off = document.createElement('canvas');
            off.width = w; off.height = h;
            var c = off.getContext('2d');
            c.fillStyle = '#fff';
            c.fillRect(0, 0, w, h);
            c.drawImage(node, 0, 0, w, h);
            var d = c.getImageData(0, 0, w, h).data;
            var counts = {}, best = null, bestN = 0;
            for (var i = 0; i < d.length; i += 4) {
                var key = (d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5);
                var n = (counts[key] = (counts[key] || 0) + 1);
                if (n > bestN) { bestN = n; best = [d[i], d[i + 1], d[i + 2]]; }
            }
            return best;
        } catch (e) {
            return null;
        }
    }

    function applyAmbient(node) {
        var rgb = dominantColor(node);
        if (!rgb) {
            overlay.style.background = '';
            overlay.classList.remove('fig-zoom--light');
            return;
        }
        overlay.style.background = 'rgb(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ')';
        var lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        overlay.classList.toggle('fig-zoom--light', lum > 0.6);
    }

    // Diagrams don't reflow — scale the whole thing down to fit the viewport.
    function fitDiagram() {
        el.style.transform = 'none';
        el.style.transformOrigin = 'center center';   // fit-wide.js leaves this 'top left'
        el.style.maxWidth = 'none';
        el.style.width = 'max-content';
        el.style.height = '';
        var availW = inner.clientWidth - 32;
        var availH = inner.clientHeight - 80;
        var w = el.offsetWidth, h = el.offsetHeight;
        if (!w || !h) return;
        var s = Math.min(1, availW / w, availH / h);
        el.style.transform = s < 1 ? 'scale(' + s + ')' : 'none';
    }

    function render() {
        if (!el) return;
        if (media) {
            if (zoomed) {                       // actual size — scroll/pan
                el.classList.add('is-zoomed');
                var nW = el.naturalWidth || 0, nH = el.naturalHeight || 0;
                el.style.width = nW ? nW + 'px' : '';
                el.style.height = nH ? nH + 'px' : '';
                overlay.style.overflow = 'auto';
                inner.style.alignItems = 'flex-start';
                inner.style.minWidth = nW ? nW + 'px' : '';
                inner.style.height = 'auto';        // grow so the overlay scrolls
                inner.style.minHeight = '100%';
            } else {                            // fit to screen
                el.classList.remove('is-zoomed');
                el.style.width = '';
                el.style.height = '';
                overlay.style.overflow = 'hidden';
                inner.style.alignItems = '';
                inner.style.minWidth = '';
                inner.style.height = '';
                inner.style.minHeight = '';
            }
        } else {                                // diagram / fallback
            if (zoomed) {
                el.style.transform = 'none';
                el.style.transformOrigin = 'center center';
                el.style.maxWidth = 'none';
                el.style.width = 'max-content';
                el.style.height = '';
                overlay.style.overflow = 'auto';
                inner.style.alignItems = 'flex-start';
                inner.style.minWidth = '';
                inner.style.height = 'auto';
                inner.style.minHeight = '100%';
            } else {
                fitDiagram();
                overlay.style.overflow = 'hidden';
                inner.style.alignItems = '';
                inner.style.minWidth = '';
                inner.style.height = '';
                inner.style.minHeight = '';
            }
        }
        el.style.cursor = zoomed ? 'zoom-out' : 'zoom-in';
    }

    // Highest-resolution source for an <img> — the largest srcset candidate, so
    // "actual size" zooms to the full image, not the small responsive variant
    // the browser happened to load for the in-page display.
    function bestSrc(imgEl) {
        var srcset = imgEl.getAttribute('srcset');
        if (srcset) {
            var best = null, bestW = 0;
            srcset.split(',').forEach(function (part) {
                var m = part.trim().match(/(\S+)\s+(\d+)w/);
                if (m && +m[2] > bestW) { bestW = +m[2]; best = m[1]; }
            });
            if (best) return best;
        }
        return imgEl.currentSrc || imgEl.src;
    }

    // Build the <img> shown in the overlay (snapshot for canvas, clone for img).
    // Actual-size dimensions come from the loaded media's own naturalWidth/Height
    // at zoom time. Returns null to fall back to moving the live element
    // (diagrams, or a tainted canvas).
    function buildMedia(target) {
        var img = null;
        if (target.tagName === 'CANVAS') {
            try {
                img = new Image();
                img.src = target.toDataURL('image/png');
            } catch (e) {
                img = null;
            }
        } else if (target.tagName === 'IMG') {
            img = new Image();
            img.src = bestSrc(target);
        }
        if (img) {
            img.className = 'fig-zoom-media';
            img.alt = target.alt || '';
            // If the user zooms before the full-res media decodes, re-render once it's ready.
            img.addEventListener('load', function () { if (el === img && zoomed) render(); });
        }
        return img;
    }

    function open(target) {
        if (overlay.classList.contains('is-open')) return;
        zoomed = false;
        var img = buildMedia(target);
        if (img) {
            media = true;
            el = img;
            inner.appendChild(el);
        } else {                                // move the live element
            media = false;
            el = target;
            placeholder = document.createComment('fig-zoom');
            savedStyle = el.getAttribute('style');
            el.parentNode.insertBefore(placeholder, el);
            inner.appendChild(el);
        }
        overlay.classList.add('is-open');
        document.documentElement.style.overflow = 'hidden';
        applyAmbient(target);
        render();
    }

    function close() {
        if (!el) return;
        if (media) {
            inner.removeChild(el);
        } else {
            if (savedStyle === null) el.removeAttribute('style');
            else el.setAttribute('style', savedStyle);
            placeholder.parentNode.replaceChild(el, placeholder);
        }
        overlay.classList.remove('is-open', 'fig-zoom--light');
        overlay.style.background = '';
        overlay.style.overflow = '';
        inner.style.cssText = '';
        document.documentElement.style.overflow = '';
        el = null; media = false; placeholder = null; savedStyle = null; zoomed = false;
    }

    overlay.addEventListener('click', function (e) {
        if (e.target.closest('.fig-zoom__close')) { close(); return; }
        if (el && (e.target === el || el.contains(e.target))) {   // toggle zoom on the artifact
            zoomed = !zoomed;
            render();
            return;
        }
        close();                                // clicked the backdrop
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') close();
    });
    var rt;
    window.addEventListener('resize', function () {
        if (!el || zoomed) return;              // keep the user's zoom; only re-fit
        clearTimeout(rt);
        rt = setTimeout(render, 150);
    }, { passive: true });

    // Note: .rpt-series (the responsive series-nav card) is intentionally excluded
    // — it's not a static figure, and capturing its clicks would hijack its links.
    var SELECTOR = '.mpd-wrap, .katex-display, canvas, img';

    // The expandable artifact for a click, or null. Excludes things with their
    // own handling: in-page anchors, the failure-mode cards (.fmc has its own
    // lightbox), the overlay itself, and multi-image galleries (left to
    // PhotoSwipe). Single Ghost images (.kg-image) ARE included.
    function zoomTarget(t) {
        var node = t && t.closest && t.closest(SELECTOR);
        if (!node || !content.contains(node)) return null;
        if (node.closest('a[href^="#"]') || node.closest('.fmc') ||
            node.closest('.fig-zoom') || node.closest('.kg-gallery-card')) return null;
        return node;
    }

    // Delegated, CAPTURE phase: fires before the image's own PhotoSwipe click
    // listener, so stopPropagation() suppresses Ghost's lightbox and this zoom
    // takes over every artifact uniformly (charts, diagrams, formulas, images).
    content.addEventListener('click', function (e) {
        var node = zoomTarget(e.target);
        if (!node) return;
        e.preventDefault();
        e.stopPropagation();
        open(node);
    }, true);

    // Cursor affordance (no per-element click listeners — the delegated one above
    // does the work).
    function markZoomable() {
        Array.prototype.forEach.call(content.querySelectorAll(SELECTOR), function (node) {
            if (node._figZoom) return;
            if (node.closest('a[href^="#"]') || node.closest('.fmc') ||
                node.closest('.fig-zoom') || node.closest('.kg-gallery-card')) return;
            node._figZoom = true;
            node.classList.add('fig-zoomable');
        });
    }

    markZoomable();
    document.addEventListener('DOMContentLoaded', markZoomable);
    window.addEventListener('load', markZoomable);
})();
