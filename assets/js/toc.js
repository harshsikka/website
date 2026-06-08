/* Floating table of contents.
 * Renders from the post's headings into #fig-toc, highlights the section in
 * view, and smooth-scrolls on click. Self-guards: does nothing unless we're on
 * a post with at least two headings. */
(function () {
    'use strict';

    var toc = document.getElementById('fig-toc');
    var content = document.querySelector('.gh-content');
    if (!toc || !content) return;

    var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
    // Not worth a ToC for one or zero sections.
    if (headings.length < 2) return;

    function slugify(text) {
        return text.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    var list = document.createElement('ul');
    list.className = 'fig-toc-list';
    var links = [];

    headings.forEach(function (heading) {
        if (!heading.id) {
            var base = slugify(heading.textContent) || 'section';
            var id = base, n = 1;
            while (document.getElementById(id)) { id = base + '-' + n++; }
            heading.id = id;
        }
        // Give headings a scroll anchor so they don't sit flush at the top edge.
        heading.style.scrollMarginTop = '32px';

        var li = document.createElement('li');
        li.className = 'fig-toc-item' + (heading.tagName === 'H3' ? ' fig-toc-sub' : '');

        var a = document.createElement('a');
        a.className = 'fig-toc-link';
        a.href = '#' + heading.id;
        a.textContent = heading.textContent;
        a.addEventListener('click', function (e) {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', '#' + heading.id);
        });

        li.appendChild(a);
        list.appendChild(li);
        links.push({ id: heading.id, link: a });
    });

    var label = document.createElement('p');
    label.className = 'fig-toc-label';
    label.textContent = 'Contents';
    toc.appendChild(label);
    toc.appendChild(list);
    toc.hidden = false;

    // Scrollspy: the active section is the last heading whose top has scrolled
    // above a line near the top of the viewport. Purely position-based, so
    // there's no dead zone between sections.
    var MARKER = 140;
    function setActive() {
        var activeId = headings[0].id;
        for (var i = 0; i < headings.length; i++) {
            if (headings[i].getBoundingClientRect().top <= MARKER) {
                activeId = headings[i].id;
            } else {
                break;
            }
        }
        links.forEach(function (l) {
            l.link.classList.toggle('is-active', l.id === activeId);
        });
    }

    // Placement is fully measured (not hard-coded), so it adapts to whatever
    // the layout does:
    //  - horizontal: sits in the gutter just right of the content column, and
    //    hides itself when that gutter is too narrow to be readable.
    //  - vertical: anchors to the article TITLE (always above any feature
    //    image), starts level with it, then rises and sticks near the top.
    var anchorEl = document.querySelector('.gh-article-title') || content;
    var gutterEl = document.querySelector('.fig-content') || content;
    var STICK_TOP = 48;
    var GAP = 28;
    var MIN_WIDTH = 150;
    var anchorTop = 0;
    function measure() {
        anchorTop = anchorEl.getBoundingClientRect().top + window.pageYOffset;
    }
    function position() {
        // Horizontal: gutter between the content's right edge and the viewport.
        var rightEdge = gutterEl.getBoundingClientRect().right;
        var avail = window.innerWidth - rightEdge - GAP * 2;
        if (avail < MIN_WIDTH) { toc.style.display = 'none'; return; }
        toc.style.display = 'block';
        toc.style.left = (rightEdge + GAP) + 'px';
        toc.style.width = Math.min(240, avail) + 'px';

        // Vertical: level with the title, then stick.
        var top = Math.max(STICK_TOP, anchorTop - window.pageYOffset);
        toc.style.top = top + 'px';
        toc.style.maxHeight = 'calc(100vh - ' + (top + 24) + 'px)';
    }

    // rAF-throttle the scroll work.
    var ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () { position(); setActive(); ticking = false; });
    }
    function onResize() { measure(); position(); setActive(); }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // Feature images can shift the body down after they load.
    window.addEventListener('load', onResize);

    measure();
    position();
    setActive();
})();
