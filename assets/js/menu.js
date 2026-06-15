/* Fig mobile nav: collapse the sidebar nav behind a Menu / Close toggle.
   No-ops on desktop (button is CSS-hidden) and if the markup isn't present. */
(function () {
    var sidebar = document.querySelector('.fig-sidebar');
    if (!sidebar) return;
    var toggle = sidebar.querySelector('.fig-menu-toggle');
    if (!toggle) return;

    function setOpen(open) {
        sidebar.classList.toggle('is-menu-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.documentElement.style.overflowY = open ? 'hidden' : '';
    }

    toggle.addEventListener('click', function () {
        setOpen(!sidebar.classList.contains('is-menu-open'));
    });

    /* Tapping a nav link closes the overlay. */
    sidebar.querySelectorAll('.fig-nav-links a').forEach(function (link) {
        link.addEventListener('click', function () { setOpen(false); });
    });

    /* Escape closes it too. */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') setOpen(false);
    });
})();
