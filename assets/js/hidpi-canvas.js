/* High-DPI canvas shim for in-content charts.
 *
 * The report charts are hand-rolled <canvas> drawings whose inline scripts set
 * the backing store equal to the CSS display size (devicePixelRatio 1). That
 * looks fine at full width on desktop but has no spare pixels, so the text turns
 * to mush the moment the chart is magnified (tap-to-expand / pinch-zoom on
 * mobile).
 *
 * This patches getContext('2d') for canvases inside .gh-content so the backing
 * store is rendered at a higher resolution while the on-screen size is
 * unchanged. The chart code keeps drawing in its own logical coordinates (we
 * pre-scale the context with setTransform), so nothing in the chart scripts has
 * to change — current and future charts get crisp text for free.
 *
 * Loaded synchronously in <head> so the patch is in place before the inline
 * chart scripts run their first draw() on DOMContentLoaded. */
(function () {
    'use strict';
    var proto = window.HTMLCanvasElement && HTMLCanvasElement.prototype;
    if (!proto || !proto.getContext) return;

    var DESIRED = 3;             // target pixel-density multiplier
    var MAX_DIM = 4096;          // iOS Safari per-canvas dimension cap
    var MAX_AREA = 16000000;     // iOS Safari per-canvas area cap

    function safeScale(w, h) {
        // Never exceed the platform canvas limits (exceeding them blanks the
        // canvas on iOS), and never downscale below 1.
        return Math.max(1, Math.min(
            DESIRED,
            MAX_DIM / w,
            MAX_DIM / h,
            Math.sqrt(MAX_AREA / (w * h))
        ));
    }

    var orig = proto.getContext;
    proto.getContext = function (type) {
        // Recognise in-content chart canvases once, then keep applying hi-DPI
        // even after they're moved out of .gh-content (e.g. into the tap-to-
        // expand overlay, where the chart's ResizeObserver redraws them).
        if (type === '2d' && (this.__figChart ||
                (this.closest && this.closest('.gh-content')))) {
            this.__figChart = true;
            var lw = this.width, lh = this.height;     // logical size just set by the chart
            var sig = lw + 'x' + lh;
            // Re-scale only when the chart has (re)sized the canvas to a logical
            // size; skip if we already enlarged this exact backing store.
            if (sig !== this.__hidpiSig && lw > 0 && lh > 0) {
                var s = safeScale(lw, lh);
                if (s > 1.01) {
                    this.style.width = lw + 'px';
                    this.style.height = lh + 'px';
                    this.width = Math.round(lw * s);   // enlarge backing store
                    this.height = Math.round(lh * s);
                    this.__hidpiScale = s;
                } else {
                    this.__hidpiScale = 1;
                }
                this.__hidpiSig = this.width + 'x' + this.height;
            }
            var ctx = orig.call(this, '2d');
            if (ctx && this.__hidpiScale > 1) {
                // Map the chart's logical coordinates onto the enlarged backing.
                ctx.setTransform(this.__hidpiScale, 0, 0, this.__hidpiScale, 0, 0);
            }
            return ctx;
        }
        return orig.apply(this, arguments);
    };
})();
