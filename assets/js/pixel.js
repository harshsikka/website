/* Fig — pixel cursor trail + nav hover burst (ported from the Metarch landing) */
(function () {
    // skip on touch / no-hover devices
    if (window.matchMedia && window.matchMedia('(hover: none)').matches) return;

    var pixelCount = 3;        // number of trailing pixels
    var pixelSize = 8;         // size of each pixel
    var pixels = [];

    // create trailing pixel elements
    for (var i = 0; i < pixelCount; i++) {
        var pixel = document.createElement('div');
        pixel.className = 'pixel';
        document.body.appendChild(pixel);
        pixels.push({ element: pixel, x: 0, y: 0, targetX: 0, targetY: 0 });
    }

    // mouse position history for the trail
    var mouseHistory = [];
    var historySize = pixelCount * 3;

    document.addEventListener('mousemove', function (e) {
        mouseHistory.unshift({ x: e.clientX, y: e.clientY });
        if (mouseHistory.length > historySize) mouseHistory.pop();

        pixels.forEach(function (pixel, index) {
            var historyIndex = (index + 1) * 2;
            if (mouseHistory[historyIndex]) {
                pixel.targetX = mouseHistory[historyIndex].x - pixelSize / 2;
                pixel.targetY = mouseHistory[historyIndex].y - pixelSize / 2;
                pixel.element.classList.add('active');
            }
        });
    });

    // smooth animation loop, snapped to the pixel grid
    function animate() {
        pixels.forEach(function (pixel) {
            pixel.x += (pixel.targetX - pixel.x) * 0.3;
            pixel.y += (pixel.targetY - pixel.y) * 0.3;
            pixel.element.style.left = Math.round(pixel.x / pixelSize) * pixelSize + 'px';
            pixel.element.style.top = Math.round(pixel.y / pixelSize) * pixelSize + 'px';
        });
        requestAnimationFrame(animate);
    }
    animate();

    document.addEventListener('mouseleave', function () {
        pixels.forEach(function (p) { p.element.classList.remove('active'); });
    });
    document.addEventListener('mouseenter', function () {
        pixels.forEach(function (p) { p.element.classList.add('active'); });
    });

    // pixel burst when hovering nav links (sidebar nav + top nav)
    var navLinks = document.querySelectorAll('.fig-nav-links a, .gh-navigation-menu a, .gh-footer-menu a');
    navLinks.forEach(function (link) {
        link.addEventListener('mouseenter', function () {
            var rect = link.getBoundingClientRect();
            var centerX = rect.left + rect.width / 2;
            var centerY = rect.top + rect.height / 2;
            var burstCount = 8;

            for (var i = 0; i < burstCount; i++) {
                var pixel = document.createElement('div');
                pixel.className = 'pixel-burst';

                var angle = (i / burstCount) * Math.PI * 2;
                var distance = 30 + Math.random() * 20;
                var endX = Math.cos(angle) * distance;
                var endY = Math.sin(angle) * distance;

                pixel.style.left = centerX + 'px';
                pixel.style.top = centerY + 'px';
                pixel.style.transform =
                    'translate(-50%, -50%) translate(' + endX + 'px, ' + endY + 'px) scale(0)';
                pixel.style.animation = 'burst-custom 0.6s ease-out forwards';

                document.body.appendChild(pixel);
                setTimeout((function (el) {
                    return function () { el.remove(); };
                })(pixel), 600);
            }
        });
    });
})();
