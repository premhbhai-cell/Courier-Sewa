/*
 * +91 mobile inputs, app-wide.
 *
 * Every phone / mobile / WhatsApp field gets a fixed "+91" box and takes only
 * the 10-digit number. The server stores it as +91XXXXXXXXXX (the
 * NormalizesPhones model trait) and validates it (App\Rules\IndianMobile).
 *
 * - A stored "+919876543210" (or 0- / 91-prefixed) value shows as its 10 digits,
 *   including values set later by page scripts ($(el).val(...) / el.value = ...).
 * - Typing or pasting keeps digits only, max 10; a pasted +91 / 0 prefix is dropped.
 * - Inputs added later (AJAX-loaded edit modals) are picked up automatically.
 * - Abroad: the receiver of an International booking, or a receiver whose
 *   country isn't India, keeps a free-form number (no +91 box, no limit).
 *
 * Opt out on a single field with data-phone-free.
 */
(function () {
    'use strict';
    if (window.__esecrmPhoneInput) return; // included by the layout and by some partials
    window.__esecrmPhoneInput = true;

    var NAMES = ['phone', 'mobile', 'sender_mobile', 'receiver_mobile', 'sender_whatsapp',
        'contact_number', 'vendor_phone', 'b_sender_mobile', 'b_receiver_mobile'];
    var SELECTOR = NAMES.map(function (n) { return 'input[name="' + n + '"]'; }).join(',') + ',input[data-phone-in]';
    var native = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // 10-digit local part of an Indian mobile, or the value unchanged.
    function localize(v) {
        if (v === null || v === undefined) return v;
        var s = String(v), d = s.replace(/\D/g, '');
        if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
        else if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
        return /^[6-9]\d{9}$/.test(d) ? d : s;
    }

    // Numbers that may be foreign: International booking receivers, receivers abroad.
    function isAbroad(input) {
        var form = input.form || input.closest('form');
        if (!form) return false;
        var name = input.getAttribute('name');
        if (name === 'receiver_mobile' || name === 'b_receiver_mobile') {
            var t = form.querySelector('input[name="booking_type"]:checked') || form.querySelector('[name="booking_type"]');
            if (t && String(t.value) === 'International') return true;
        }
        if (name === 'mobile') {
            var c = form.querySelector('input[name="country"], select[name="country"]');
            if (c) {
                var cv = String(c.value || '').trim().toLowerCase();
                if (cv !== '' && ['india', 'in', 'ind'].indexOf(cv) === -1) return true;
            }
        }
        return false;
    }

    function applyMode(input) {
        var abroad = isAbroad(input);
        var span = input.__phonePrefix;
        if (span) span.style.display = abroad ? 'none' : '';
        if (abroad) {
            input.removeAttribute('maxlength');
            input.removeAttribute('pattern');
            input.setAttribute('inputmode', 'tel');
        } else {
            input.setAttribute('maxlength', '10');
            input.setAttribute('pattern', '[6-9][0-9]{9}');
            input.setAttribute('inputmode', 'numeric');
            input.setAttribute('title', 'Enter a valid 10-digit mobile number');
        }
        input.__phoneAbroad = abroad;
    }

    function enhance(input) {
        if (input.__phoneDone || input.type === 'hidden' || input.hasAttribute('data-phone-free')) return;
        input.__phoneDone = true;

        // Show stored +91 values as 10 digits, whoever sets them.
        try {
            Object.defineProperty(input, 'value', {
                configurable: true,
                get: function () { return native.get.call(this); },
                set: function (v) { native.set.call(this, this.__phoneAbroad ? v : localize(v)); }
            });
        } catch (e) { /* very old browser: initial value still localized below */ }

        // "+91" box: join an existing input-group, or wrap the input in one.
        var span = document.createElement('span');
        span.className = 'input-group-text in-phone-prefix';
        span.textContent = '+91';
        var parent = input.parentNode;
        if (parent && parent.classList && parent.classList.contains('input-group')) {
            parent.insertBefore(span, input);
        } else if (parent) {
            var group = document.createElement('div');
            group.className = 'input-group in-phone-group' + (input.classList.contains('form-control-sm') ? ' input-group-sm' : '');
            parent.insertBefore(group, input);
            group.appendChild(span);
            group.appendChild(input);
        }
        input.__phonePrefix = span;
        if (!input.getAttribute('placeholder') || /mobile|phone|number|contact/i.test(input.getAttribute('placeholder'))) {
            input.setAttribute('placeholder', '10-digit mobile number');
        }
        input.setAttribute('autocomplete', input.getAttribute('autocomplete') || 'tel-national');

        applyMode(input);
        native.set.call(input, input.__phoneAbroad ? native.get.call(input) : localize(native.get.call(input)));

        input.addEventListener('input', function () {
            if (input.__phoneAbroad) return;
            var raw = native.get.call(input), loc = localize(raw);
            var digits = (loc === raw ? raw.replace(/\D/g, '') : loc).slice(0, 10);
            if (digits !== raw) native.set.call(input, digits);
        });
    }

    function scan(root) {
        (root.querySelectorAll ? root : document).querySelectorAll(SELECTOR).forEach(enhance);
        if (root.matches && root.matches(SELECTOR)) enhance(root);
    }

    function init() {
        scan(document);
        new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.addedNodes.forEach(function (n) { if (n.nodeType === 1) scan(n); });
            });
        }).observe(document.body, { childList: true, subtree: true });

        // Booking type / receiver country can switch a field between +91 and free-form.
        document.addEventListener('change', function (e) {
            var t = e.target;
            if (!t || !t.name || (t.name !== 'booking_type' && t.name !== 'country')) return;
            var form = t.form || t.closest('form');
            if (!form) return;
            form.querySelectorAll(SELECTOR).forEach(function (i) { if (i.__phoneDone) applyMode(i); });
        });
        document.addEventListener('input', function (e) {
            if (e.target && e.target.name === 'country') {
                var form = e.target.form || e.target.closest('form');
                if (form) form.querySelectorAll(SELECTOR).forEach(function (i) { if (i.__phoneDone) applyMode(i); });
            }
        });
    }


    // WhatsApp share prompt with a fixed +91 box: resolves to "91XXXXXXXXXX"
    // (what wa.me / web.whatsapp.com expect) or null when cancelled.
    // opts.recipients = [{ label: 'Client', name, number }, ...] adds "send to"
    // choices above the box (plus "Enter number manually"); picking one fills the
    // box, a choice without a valid number is shown disabled. Without it the
    // prompt is the plain number box, prefilled with defaultNumber.
    window.askWhatsappNumber = async function (defaultNumber, target, opts) {
        opts = opts || {};
        var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
        var valid = function (n) { return /^[6-9]\d{9}$/.test(n); };
        var local = localize(defaultNumber || '');
        if (!valid(local)) local = '';

        var recipients = (opts.recipients || []).map(function (rc) {
            var n = String(localize(rc.number || '')).replace(/\D/g, '');
            return { label: rc.label, name: (rc.name && rc.name !== '—' && rc.name !== '-') ? rc.name : '', number: valid(n) ? n : '' };
        });
        var choicesHtml = '';
        if (recipients.length) {
            // Default: the recipient whose number matches defaultNumber, else the first one with a number, else manual.
            var pick = recipients.findIndex(function (rc) { return rc.number && rc.number === local; });
            if (pick < 0) pick = recipients.findIndex(function (rc) { return rc.number; });
            local = pick >= 0 ? recipients[pick].number : '';
            var opt = function (val, title, sub, checked, disabled) {
                return '<label class="wa-choice' + (disabled ? ' is-disabled' : '') + '" style="display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:6px;cursor:' + (disabled ? 'not-allowed' : 'pointer') + ';opacity:' + (disabled ? '.55' : '1') + ';text-align:left;">'
                    + '<input type="radio" name="waRecipient" value="' + val + '" class="form-check-input m-0"' + (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '>'
                    + '<span style="line-height:1.25;"><span style="font-weight:600;font-size:14px;">' + title + '</span>'
                    + (sub ? '<br><small class="text-muted">' + sub + '</small>' : '') + '</span></label>';
            };
            choicesHtml = '<div style="max-width:320px;margin:4px auto 10px;">'
                + recipients.map(function (rc, i) {
                    var sub = [rc.name ? esc(rc.name) : '', rc.number ? '+91 ' + rc.number : 'No valid mobile number'].filter(Boolean).join(' · ');
                    return opt(i, 'Send to ' + esc(rc.label), sub, i === pick, !rc.number);
                }).join('')
                + opt('manual', 'Enter number manually', '', pick < 0, false)
                + '</div>';
        }

        var r = await Swal.fire({
            title: opts.title || 'WhatsApp Number',
            html: choicesHtml
                + '<div class="input-group" style="max-width:320px;margin:6px auto 0;">'
                + '<span class="input-group-text">+91</span>'
                + '<input id="waNumberInput" type="tel" inputmode="numeric" maxlength="10" class="form-control" placeholder="10-digit mobile number" value="' + local + '">'
                + '</div>',
            showCancelButton: true,
            confirmButtonText: opts.confirmText || 'Send',
            confirmButtonColor: opts.color || 'var(--theme-primary, #006666)',
            focusConfirm: false,
            target: target || document.body,
            didOpen: function () {
                var i = document.getElementById('waNumberInput');
                var popup = Swal.getPopup();
                popup.querySelectorAll('input[name="waRecipient"]').forEach(function (radio) {
                    radio.addEventListener('change', function () {
                        if (radio.value === 'manual') { i.value = ''; i.focus(); return; }
                        i.value = recipients[+radio.value].number;
                    });
                });
                if (!recipients.length || !i.value) i.focus();
                i.addEventListener('input', function () {
                    var l = localize(i.value);
                    i.value = String(l).replace(/\D/g, '').slice(0, 10);
                    // Typing a different number means it is a manual entry.
                    var match = recipients.findIndex(function (rc) { return rc.number && rc.number === i.value; });
                    var radio = popup.querySelector('input[name="waRecipient"][value="' + (match >= 0 ? match : 'manual') + '"]');
                    if (radio) radio.checked = true;
                });
            },
            preConfirm: function () {
                var v = document.getElementById('waNumberInput').value.replace(/\D/g, '');
                if (!/^[6-9]\d{9}$/.test(v)) {
                    Swal.showValidationMessage('Enter a valid 10-digit mobile number');
                    return false;
                }
                return '91' + v;
            }
        });
        return r.isConfirmed ? r.value : null;
    };

    window.esecrmPhoneLocal = localize;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
