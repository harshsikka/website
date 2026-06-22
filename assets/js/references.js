/* Inline references / citations.
 *
 * Authoring convention (pure Ghost editor):
 *   - cite inline as plain text: "...task context.[17]"
 *   - end the post with a heading whose text is "References", followed by a
 *     numbered list (one reference per item, in order).
 *
 * This script then:
 *   - ids each reference list item (#ref-N)
 *   - turns each [N] in the body into a superscript link to #ref-N
 *   - shows the full reference in a hover/focus popover
 *   - smooth-scrolls + flashes the target on click
 *   - adds back-links from each reference to its citation(s)
 *
 * Guard: a [N] is only linkified when 1 <= N <= number of references, so
 * stray brackets in prose — and posts with no reference list — are untouched.
 */
(function () {
    'use strict';

    var content = document.querySelector('.gh-content');
    if (!content) return;

    // 1. Locate the "References" heading and its list.
    var heading = null;
    var hs = content.querySelectorAll('h1, h2, h3, h4');
    for (var i = 0; i < hs.length; i++) {
        if (hs[i].textContent.trim().toLowerCase() === 'references') { heading = hs[i]; break; }
    }
    if (!heading) return;

    if (!heading.id) heading.id = 'references';

    var refs = {};        // N -> { el, text }
    var refEls = [];      // the reference elements themselves (skipped when linkifying)
    var maxRef = 0;

    function addRef(n, el) {
        el.id = 'ref-' + n;
        el.classList.add('fig-reference');
        refs[n] = { el: el, text: el.textContent.trim() };
        refEls.push(el);
        if (n > maxRef) maxRef = n;
    }

    // Style A — a numbered list (<ol>/<ul>) after the heading; N = position.
    var list = heading.nextElementSibling;
    while (list && list.tagName !== 'OL' && list.tagName !== 'UL' && !/^H[1-6]$/.test(list.tagName)) {
        list = list.nextElementSibling;
    }
    if (list && (list.tagName === 'OL' || list.tagName === 'UL')) {
        list.classList.add('fig-references');
        Array.prototype.slice.call(list.children).forEach(function (li, idx) {
            if (li.tagName === 'LI') addRef(idx + 1, li);
        });
    } else {
        // Style B — one block per reference, each starting "[N] ..." (e.g. a
        // run of <p> paragraphs). N is read from the leading marker.
        var p = heading.nextElementSibling;
        while (p && !/^H[1-6]$/.test(p.tagName)) {
            var lead = p.textContent.trim().match(/^\[(\d+)\]/);
            if (lead) addRef(parseInt(lead[1], 10), p);
            p = p.nextElementSibling;
        }
    }
    if (!maxRef) return;

    // 2. Linkify [N] markers in body text (everything except the list itself).
    var occurrences = {};   // N -> count
    // Matches comma lists and ranges: [5], [1, 2, 3], [3-12], [1, 3-12].
    var marker = /\[(\d+(?:\s*-\s*\d+)?(?:\s*,\s*\d+(?:\s*-\s*\d+)?)*)\]/g;

    function skip(node) {
        var el = node.parentNode;
        while (el && el !== content) {
            var tag = el.tagName;
            if (tag === 'A' || tag === 'SUP' || tag === 'CODE' || tag === 'PRE' ||
                tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE' || tag === 'NOSCRIPT' ||
                /^H[1-6]$/.test(tag) || el === list ||
                (el.classList && el.classList.contains('fig-reference'))) return true;
            el = el.parentNode;
        }
        return false;
    }

    var walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
            if (!node.nodeValue || node.nodeValue.indexOf('[') === -1) return NodeFilter.FILTER_REJECT;
            if (skip(node)) return NodeFilter.FILTER_REJECT;
            marker.lastIndex = 0;
            return marker.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
    });

    var targets = [];
    var t;
    while ((t = walker.nextNode())) targets.push(t);

    targets.forEach(function (node) {
        var text = node.nodeValue;
        var frag = document.createDocumentFragment();
        var last = 0, m;
        marker.lastIndex = 0;
        while ((m = marker.exec(text))) {
            var inner = m[1];
            // Every explicit number must be a real reference (1..maxRef). A
            // range "3-12" contributes its two written endpoints (3 and 12);
            // the implied middle numbers are never rendered, so aren't checked.
            var nums = inner.match(/\d+/g).map(function (s) { return parseInt(s, 10); });
            var valid = nums.every(function (n) { return n >= 1 && n <= maxRef; });
            if (!valid) continue;

            if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));

            var sup = document.createElement('sup');
            sup.className = 'fig-cite';
            sup.appendChild(document.createTextNode('['));
            // Walk the marker piece by piece: each number becomes a link, each
            // separator (",", "-", spaces) stays plain text, so the displayed
            // string is exactly as authored — "[1, 3-12]" links only 1, 3, 12.
            var piece, pieceRe = /(\d+)|([^\d]+)/g;
            while ((piece = pieceRe.exec(inner))) {
                if (piece[2] !== undefined) {
                    sup.appendChild(document.createTextNode(piece[2]));
                    continue;
                }
                var n = parseInt(piece[1], 10);
                occurrences[n] = (occurrences[n] || 0) + 1;
                var a = document.createElement('a');
                a.href = '#ref-' + n;
                a.id = 'cite-' + n + '-' + occurrences[n];
                a.textContent = piece[1];
                a.setAttribute('data-ref', n);
                sup.appendChild(a);
            }
            sup.appendChild(document.createTextNode(']'));
            frag.appendChild(sup);
            last = m.index + m[0].length;
        }
        if (last) {
            if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
            node.parentNode.replaceChild(frag, node);
        }
    });

    // 3. Back-links from each reference to its citation(s).
    Object.keys(occurrences).forEach(function (n) {
        var li = refs[n] && refs[n].el;
        if (!li) return;
        var count = occurrences[n];
        var wrap = document.createElement('span');
        wrap.className = 'fig-ref-backlinks';
        for (var k = 1; k <= count; k++) {
            var back = document.createElement('a');
            back.className = 'fig-ref-backlink';
            back.href = '#cite-' + n + '-' + k;
            back.textContent = count > 1 ? ('↩' + String.fromCharCode(96 + k)) : '↩';
            back.setAttribute('aria-label', 'Back to citation');
            wrap.appendChild(back);
        }
        li.appendChild(wrap);
    });

    // 4. Hover/focus popover.
    var pop = document.createElement('div');
    pop.className = 'fig-ref-popover';
    pop.hidden = true;
    document.body.appendChild(pop);
    var hideTimer = null;

    function showPopover(a) {
        var n = a.getAttribute('data-ref');
        if (!refs[n]) return;
        pop.textContent = refs[n].text;
        pop.hidden = false;
        var r = a.getBoundingClientRect();
        var pr = pop.getBoundingClientRect();
        var top = window.pageYOffset + r.top - pr.height - 8;
        var aboveOffscreen = r.top - pr.height - 8 < 0;
        if (aboveOffscreen) top = window.pageYOffset + r.bottom + 8;
        var left = window.pageXOffset + r.left;
        left = Math.min(left, window.pageXOffset + document.documentElement.clientWidth - pr.width - 12);
        pop.style.top = top + 'px';
        pop.style.left = Math.max(12, left) + 'px';
    }
    function hidePopover() { pop.hidden = true; }

    // 5. Smooth-scroll + flash on click.
    function flash(el) {
        el.classList.remove('is-flash');
        void el.offsetWidth;
        el.classList.add('is-flash');
    }

    content.addEventListener('mouseover', function (e) {
        var a = e.target.closest && e.target.closest('.fig-cite a');
        if (a) { clearTimeout(hideTimer); showPopover(a); }
    });
    content.addEventListener('mouseout', function (e) {
        if (e.target.closest && e.target.closest('.fig-cite a')) {
            hideTimer = setTimeout(hidePopover, 120);
        }
    });
    content.addEventListener('focusin', function (e) {
        var a = e.target.closest && e.target.closest('.fig-cite a');
        if (a) showPopover(a);
    });
    content.addEventListener('focusout', hidePopover);

    // Smooth-scroll for citation -> reference and back-link -> citation.
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('.fig-cite a, .fig-ref-backlink');
        if (!a) return;
        var id = a.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        hidePopover();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        history.replaceState(null, '', '#' + id);
        if (target.classList && target.classList.contains('fig-reference')) flash(target);
    });
})();
