/* ESECRM platform UI behaviours: password toggles, app switcher, landing nav.
   Vanilla JS, no dependencies — loaded by esecrm::layouts.* and usable from
   any app page that includes the switcher component. */
(function () {
    'use strict';

    var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
    var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

    /* password eye toggles ------------------------------------------------ */
    $$('.es-toggle-password').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = btn.parentElement.querySelector('input');
            var icon = btn.querySelector('i');
            if (!input) { return; }
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            if (icon) {
                icon.classList.toggle('fa-eye', !show);
                icon.classList.toggle('fa-eye-slash', show);
            }
        });
    });

    /* generic click-toggled dropdowns (switcher + landing nav "Login") ---- */
    function wireDropdown(root, toggleSel) {
        var toggle = $(toggleSel, root);
        if (!toggle) { return; }
        toggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = root.classList.toggle('is-open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }
    $$('.es-switcher').forEach(function (el) { wireDropdown(el, '.es-switcher-toggle'); });
    $$('.ls-drop').forEach(function (el) { wireDropdown(el, '.ls-drop-toggle'); });

    document.addEventListener('click', function () {
        $$('.es-switcher.is-open, .ls-drop.is-open').forEach(function (el) {
            el.classList.remove('is-open');
            var t = $('.es-switcher-toggle, .ls-drop-toggle', el);
            if (t) { t.setAttribute('aria-expanded', 'false'); }
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            $$('.es-switcher.is-open, .ls-drop.is-open').forEach(function (el) { el.classList.remove('is-open'); });
        }
    });

    /* landing nav: sticky state, mobile toggle, back-to-top --------------- */
    var nav = $('#lsNav');
    var topBtn = $('#lsTop');
    var navToggle = $('#lsNavToggle');
    var navLinks = $('#lsNavLinks');

    window.addEventListener('scroll', function () {
        var y = window.scrollY || window.pageYOffset;
        if (nav) { nav.classList.toggle('is-stuck', y > 40); }
        if (topBtn) { topBtn.classList.toggle('is-on', y > 500); }
    }, { passive: true });

    if (topBtn) {
        topBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', function (e) {
            e.stopPropagation();
            var open = navLinks.classList.toggle('is-open');
            navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        $$('a', navLinks).forEach(function (a) {
            a.addEventListener('click', function () { navLinks.classList.remove('is-open'); });
        });
    }
})();
