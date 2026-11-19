"use strict";
(function ($) {
    "use strict";

    // Global auto-upgrade: every native <input type="date"> is converted into a
    // text input driven by Air Datepicker, displaying dd/mm/yyyy, while a hidden
    // sibling input keeps the original name/id and a yyyy-mm-dd value so every
    // existing form submission and JS listener bound to that name/id keeps
    // working completely unchanged.

    // Clicking anything inside the calendar popup (e.g. the prev/next month
    // arrows) blurs the visible text input first, since the popup is appended
    // to <body> under #datepickers-container rather than living inside the
    // input itself. Track that with a mousedown flag — set before blur fires,
    // since mousedown precedes it — so the blur handler below can tell "the
    // user is still interacting with the widget" apart from "the user actually
    // left the field," instead of re-parsing/reselecting on every nav click.
    var pickerMouseDown = false;
    $(document).on('mousedown', '#datepickers-container', function () {
        pickerMouseDown = true;
    });
    $(document).on('mouseup', function () {
        setTimeout(function () { pickerMouseDown = false; }, 0);
    });

    function parseDMY(str) {
        var m = /^([0-3]?\d)\/([01]?\d)\/(\d{4})$/.exec($.trim(str));
        if (!m) return null;
        var d = parseInt(m[1], 10), mo = parseInt(m[2], 10), y = parseInt(m[3], 10);
        var date = new Date(y, mo - 1, d);
        if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
        return date;
    }

    function parseYMD(str) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec($.trim(str || ''));
        if (!m) return null;
        return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    }

    function upgradeToAirDatepicker(input) {
        var $input = $(input);
        if ($input.data('adp-upgraded')) return;
        $input.data('adp-upgraded', true);

        var name = $input.attr('name');
        var id = $input.attr('id');
        var originalValue = $input.val();

        var $hidden = $('<input>', {
            type: 'hidden',
            name: name,
            value: originalValue
        });
        $input.after($hidden);

        // Page JS across the app reads/writes this field's real value via its
        // original id (e.g. $('#filterFromDate').val() for an AJAX payload,
        // or a Clear button doing $('#filterFromDate').val('')). That id must
        // keep pointing at the element holding the real yyyy-mm-dd value, not
        // the cosmetic dd/mm/yyyy text field, or every such read/write would
        // silently start operating on the display string instead — the visible
        // input gets a new, non-colliding id and the hidden field inherits the
        // original one.
        if (id) {
            $hidden.attr('id', id);
            $input.removeAttr('id').attr('id', id + '__adpDisplay');
        }

        $input.removeAttr('name');
        $input.attr('type', 'text');
        $input.attr('autocomplete', 'off');
        if (!$input.attr('placeholder')) {
            $input.attr('placeholder', 'dd/mm/yyyy');
        }

        $input.datepicker({
            language: 'en',
            dateFormat: 'dd/mm/yyyy',
            altField: $hidden,
            altFieldDateFormat: 'yyyy-mm-dd',
            autoClose: true,
            onSelect: function () {
                $hidden.trigger('change');
            }
        });

        // Keep the visible text in sync when something ELSE sets the hidden
        // field's value programmatically (e.g. a "Clear filter" handler doing
        // $('#filterFromDate').val('').trigger('change')). Doesn't touch the
        // datepicker instance, so it can't loop back into onSelect.
        $hidden.on('change.adpUpgrade', function () {
            var v = $hidden.val();
            var displayed = v ? formatDMYFromYMD(v) : '';
            if ($input.val() !== displayed) {
                $input.val(displayed);
            }
        });

        var initialDate = parseYMD(originalValue);
        if (initialDate) {
            var inst = $input.data('datepicker');
            if (inst) inst.selectDate(initialDate);
        }

        // Support manual typing: on blur, parse dd/mm/yyyy and sync the hidden
        // field; revert display if what was typed isn't a valid date.
        $input.on('blur.adpUpgrade', function () {
            if (pickerMouseDown) return;

            var typed = $input.val();
            if (!typed) {
                $hidden.val('').trigger('change');
                return;
            }
            // Nothing to do if the typed text already matches what's selected.
            if (typed === formatDMYFromYMD($hidden.val())) return;
            var parsed = parseDMY(typed);
            var inst = $input.data('datepicker');
            if (parsed && inst) {
                inst.selectDate(parsed);
                $hidden.trigger('change');
            } else {
                $input.val($hidden.val() ? formatDMYFromYMD($hidden.val()) : '');
            }
        });
    }

    function formatDMYFromYMD(ymd) {
        var d = parseYMD(ymd);
        if (!d) return '';
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    }

    function upgradeAll(context) {
        $(context || document).find('input[type="date"]').each(function () {
            upgradeToAirDatepicker(this);
        });
    }

    $(document).ready(function () {
        upgradeAll(document);
    });

    // Exposed so pages that inject new date fields dynamically (e.g. invoice
    // line-item rows) can upgrade just the newly-added markup.
    window.upgradeDateInputs = upgradeAll;
})(jQuery);
