/**
 * Centralized CRM Frontend Utilities
 * Single place for shared calculations, formatting, and filter bindings.
 * Follows standards documented in CENTRALIZED_STANDARDS.md.
 */
(function (window, $) {
    'use strict';

    window.CRMUtils = window.CRMUtils || {};

    /**
     * Compute volumetric weight: (L * W * H / divisor) * pcs
     * Default divisor: 5000
     */
    window.CRMUtils.calcVolumetricWeight = function (l, w, h, pcs, divisor) {
        l = parseFloat(l) || 0;
        w = parseFloat(w) || 0;
        h = parseFloat(h) || 0;
        pcs = parseInt(pcs, 10) || 1;
        divisor = parseFloat(divisor) > 0 ? parseFloat(divisor) : 5000;

        if (l <= 0 || w <= 0 || h <= 0) {
            return 0;
        }

        var vol = ((l * w * h) / divisor) * pcs;
        return Math.round(vol * 1000) / 1000;
    };

    /**
     * Formats an address into a clean single line, removing blanks and double commas.
     */
    window.CRMUtils.formatAddress = function (street, city, state, pincode) {
        var parts = [street, city, state, pincode].filter(function (val) {
            return val !== null && val !== undefined && String(val).trim() !== '';
        }).map(function (val) {
            return String(val).trim();
        });
        return parts.join(', ');
    };

    /**
     * Format a monetary amount (Indian / standard decimal convention)
     */
    window.CRMUtils.formatMoney = function (amount, alwaysDecimals) {
        var num = parseFloat(amount);
        if (isNaN(num)) return '0';
        var paise = Math.round(num * 100) % 100;
        var decimals = (alwaysDecimals || paise !== 0) ? 2 : 0;
        return num.toLocaleString('en-IN', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    /**
     * Bind a filter autocomplete pair safely.
     * Integrates with window.bindFilterAc or window.bindAcHidden if available.
     */
    window.CRMUtils.bindFilterAc = function (inputId, hiddenId, listKey) {
        if (typeof window.bindFilterAc === 'function') {
            window.bindFilterAc(inputId, hiddenId);
            return;
        }

        var input = document.getElementById(inputId);
        var hidden = document.getElementById(hiddenId);
        if (!input || !hidden) return;

        if (listKey && !input.getAttribute('data-ac-list')) {
            input.setAttribute('data-ac-list', listKey);
        }

        if (typeof window.bindAcHidden === 'function') {
            window.bindAcHidden(inputId, hiddenId, {
                listKey: input.getAttribute('data-ac-list'),
                allowFreeText: true
            });
        }
    };

    /**
     * Resets all filter inputs and hidden fields inside a given container/card.
     */
    window.CRMUtils.resetFilters = function (containerSelector, onResetCallback) {
        var $container = $(containerSelector || '.filter-card');
        if (!$container.length) return;

        $container.find('input[type="text"], input[type="search"], input[type="date"], input:not([type])').val('');
        $container.find('input[type="hidden"]:not([name="_token"])').val('');
        $container.find('select').each(function () {
            if ($(this).hasClass('select2-hidden-accessible')) {
                $(this).val(null).trigger('change');
            } else {
                $(this).prop('selectedIndex', 0);
            }
        });

        if (typeof onResetCallback === 'function') {
            onResetCallback();
        }
    };

    /**
     * Opens the Centralized Tag Manager Modal for searching, viewing, removing, or adding tags.
     * Options:
     * - title: String (e.g. 'Carriers', 'Modes', 'States', 'Cities')
     * - getItems: Function() returning array of { id, label }
     * - getAvailableItems: Function() returning array of { id, label } (optional)
     * - onRemove: Function(id)
     * - onAdd: Function(id, label) (optional)
     * - onSelectAll: Function() (optional)
     * - onDeselectAll: Function() (optional)
     */
    window.CRMUtils.openTagManagerModal = function (options) {
        options = options || {};
        var modalEl = document.getElementById('tagManagerModal');
        if (!modalEl) return;

        var title = options.title || 'Selected Items';
        var getItems = options.getItems || function () { return options.items || []; };
        var getAvailableItems = options.getAvailableItems || function () { return options.availableItems || null; };
        var onRemove = options.onRemove || function () {};
        var onAdd = options.onAdd || function () {};
        var onSelectAll = options.onSelectAll || null;
        var onDeselectAll = options.onDeselectAll || null;

        var currentTab = 'selected';
        var searchQuery = '';

        var $modal = $(modalEl);
        var $title = $('#tagManagerModalTitle');
        var $countBadge = $('#tagManagerModalCountBadge');
        var $searchInput = $('#tagManagerSearchInput');
        var $clearSearchBtn = $('#tagManagerClearSearchBtn');
        var $tabSelected = $('#tagManagerTabSelected');
        var $tabAvailable = $('#tagManagerTabAvailable');
        var $tabSelectedCount = $('#tagManagerTabSelectedCount');
        var $tabAvailableCount = $('#tagManagerTabAvailableCount');
        var $container = $('#tagManagerItemsContainer');
        var $deselectAllBtn = $('#tagManagerDeselectAllBtn');
        var $selectAllBtn = $('#tagManagerSelectAllBtn');
        var $footerSummary = $('#tagManagerFooterSummary');

        $title.text('Manage: ' + title);
        $searchInput.val('');
        $clearSearchBtn.hide();

        function renderList() {
            var selectedItems = (getItems() || []).map(function (item) {
                return (typeof item === 'object') ? { id: String(item.id !== undefined ? item.id : item), label: String(item.label || item.name || item.id) } : { id: String(item), label: String(item) };
            });

            var availableRaw = getAvailableItems ? getAvailableItems() : null;
            var availableItems = [];
            if (Array.isArray(availableRaw)) {
                var selectedIdSet = new Set(selectedItems.map(function (s) { return String(s.id); }));
                availableItems = availableRaw.map(function (item) {
                    return (typeof item === 'object') ? { id: String(item.id !== undefined ? item.id : item), label: String(item.label || item.name || item.id) } : { id: String(item), label: String(item) };
                }).filter(function (item) {
                    return !selectedIdSet.has(String(item.id));
                });
            }

            // Update Counts
            $countBadge.text(selectedItems.length + ' Selected');
            $tabSelectedCount.text(selectedItems.length);

            if (availableRaw && Array.isArray(availableRaw)) {
                $tabAvailable.show();
                $tabAvailableCount.text(availableItems.length);
                if (onSelectAll) $selectAllBtn.show();
                else $selectAllBtn.hide();
            } else {
                $tabAvailable.hide();
                $selectAllBtn.hide();
                currentTab = 'selected';
            }

            if (onDeselectAll) {
                $deselectAllBtn.show().prop('disabled', selectedItems.length === 0);
            } else {
                $deselectAllBtn.hide();
            }

            // Active Tab Style
            if (currentTab === 'selected') {
                $tabSelected.addClass('active btn-outline-primary').removeClass('btn-outline-secondary');
                $tabAvailable.removeClass('active btn-outline-primary').addClass('btn-outline-secondary');
            } else {
                $tabAvailable.addClass('active btn-outline-primary').removeClass('btn-outline-secondary');
                $tabSelected.removeClass('active btn-outline-primary').addClass('btn-outline-secondary');
            }

            var itemsToDisplay = (currentTab === 'selected') ? selectedItems : availableItems;
            if (searchQuery) {
                itemsToDisplay = itemsToDisplay.filter(function (it) {
                    return it.label.toLowerCase().indexOf(searchQuery) !== -1 || it.id.toLowerCase().indexOf(searchQuery) !== -1;
                });
            }

            $container.empty();

            if (currentTab === 'selected') {
                $footerSummary.text('Showing ' + itemsToDisplay.length + ' of ' + selectedItems.length + ' selected items');
                if (itemsToDisplay.length === 0) {
                    if (selectedItems.length === 0) {
                        $container.html('<div class="text-center text-muted py-4"><i class="fa fa-info-circle fa-2x mb-2 d-block"></i>No items currently selected.</div>');
                    } else {
                        $container.html('<div class="text-center text-muted py-4"><i class="fa fa-search fa-2x mb-2 d-block"></i>No selected items match "<strong>' + $('<div>').text(searchQuery).html() + '</strong>".</div>');
                    }
                    return;
                }

                var $wrapper = $('<div class="d-flex flex-wrap gap-1"></div>');
                itemsToDisplay.forEach(function (tag) {
                    var $chip = $('<span class="tag-manager-chip"></span>');
                    $chip.append($('<span></span>').text(tag.label));
                    var $removeBtn = $('<span class="chip-remove" title="Remove">&times;</span>');
                    $removeBtn.on('click', function (e) {
                        e.stopPropagation();
                        onRemove(tag.id);
                        renderList();
                    });
                    $chip.append($removeBtn);
                    $wrapper.append($chip);
                });
                $container.append($wrapper);
            } else {
                // Available to Add
                $footerSummary.text('Showing ' + itemsToDisplay.length + ' of ' + availableItems.length + ' available items');
                if (itemsToDisplay.length === 0) {
                    if (availableItems.length === 0) {
                        $container.html('<div class="text-center text-success py-4"><i class="fa fa-check-circle fa-2x mb-2 d-block"></i>All available items are already selected!</div>');
                    } else {
                        $container.html('<div class="text-center text-muted py-4"><i class="fa fa-search fa-2x mb-2 d-block"></i>No available items match "<strong>' + $('<div>').text(searchQuery).html() + '</strong>".</div>');
                    }
                    return;
                }

                var $wrapper = $('<div class="d-flex flex-wrap gap-1"></div>');
                itemsToDisplay.forEach(function (item) {
                    var $chip = $('<span class="tag-manager-add-chip" title="Click to add"></span>');
                    $chip.append($('<span></span>').text(item.label));
                    var $addBtn = $('<span class="chip-add">+</span>');
                    $chip.append($addBtn);
                    $chip.on('click', function (e) {
                        e.stopPropagation();
                        onAdd(item.id, item.label);
                        renderList();
                    });
                    $wrapper.append($chip);
                });
                $container.append($wrapper);
            }
        }

        // Search Input
        $searchInput.off('input').on('input', function () {
            searchQuery = $(this).val().trim().toLowerCase();
            if (searchQuery.length > 0) {
                $clearSearchBtn.show();
            } else {
                $clearSearchBtn.hide();
            }
            renderList();
        });

        $clearSearchBtn.off('click').on('click', function () {
            $searchInput.val('').trigger('input').focus();
        });

        // Tabs
        $tabSelected.off('click').on('click', function () {
            currentTab = 'selected';
            renderList();
        });

        $tabAvailable.off('click').on('click', function () {
            currentTab = 'available';
            renderList();
        });

        // Bulk Actions
        $deselectAllBtn.off('click').on('click', function () {
            if (onDeselectAll) {
                onDeselectAll();
                renderList();
            }
        });

        $selectAllBtn.off('click').on('click', function () {
            if (onSelectAll) {
                onSelectAll();
                renderList();
            }
        });

        // Handle stacked modal if another modal is currently open
        $modal.off('show.bs.modal.stack').on('show.bs.modal.stack', function () {
            var maxZ = 1050;
            $('.modal.show').each(function () {
                var z = parseInt($(this).css('z-index'), 10);
                if (z > maxZ) maxZ = z;
            });
            $(this).css('z-index', maxZ + 20);
            setTimeout(function () {
                $('.modal-backdrop').last().css('z-index', maxZ + 10);
            }, 0);
        });

        $modal.off('hidden.bs.modal.stack').on('hidden.bs.modal.stack', function () {
            if ($('.modal.show').length > 0) {
                $('body').addClass('modal-open');
            }
        });

        renderList();

        var bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();

        $modal.one('shown.bs.modal', function () {
            $searchInput.focus();
        });
    };

    // ── Client Multi-Select Tag Manager (Carriers, Modes, Parcel Types) ───────
    window.clientTagStore = window.clientTagStore || {};

    window.getClientTagScope = function (scope) {
        if (!window.clientTagStore[scope]) window.clientTagStore[scope] = {};
        return window.clientTagStore[scope];
    };

    window.setClientTags = function (scope, field, items) {
        window.getClientTagScope(scope)[field] = (items || []).slice();
        window.renderClientTags(scope, field);
    };

    window.addClientTag = function (scope, field, id, label) {
        id = String(id);
        var store = window.getClientTagScope(scope);
        if (!store[field]) store[field] = [];
        if (store[field].find(function (t) { return String(t.id) === id; })) return;
        store[field].push({ id: id, label: label });
        window.renderClientTags(scope, field);
    };

    window.removeClientTag = function (scope, field, id) {
        id = String(id);
        var store = window.getClientTagScope(scope);
        store[field] = (store[field] || []).filter(function (t) { return String(t.id) !== id; });
        window.renderClientTags(scope, field);
    };

    window.renderClientTags = function (scope, field) {
        var container = document.getElementById(scope + '_' + field + '_tags');
        var hiddenContainer = document.getElementById(scope + '_' + field + '_hidden');
        if (!container || !hiddenContainer) return;
        container.innerHTML = '';
        hiddenContainer.innerHTML = '';
        var items = window.getClientTagScope(scope)[field] || [];

        var visualLimit = 2;
        var visibleItems = items.slice(0, visualLimit);

        visibleItems.forEach(function (tag) {
            var span = document.createElement('span');
            span.className = 'zone-tag';
            span.appendChild(document.createTextNode(tag.label));
            var remove = document.createElement('span');
            remove.className = 'tag-remove client-tag-remove';
            remove.textContent = '×';
            remove.dataset.scope = scope;
            remove.dataset.field = field;
            remove.dataset.id = tag.id;
            span.appendChild(remove);
            container.appendChild(span);
        });

        if (items.length > visualLimit) {
            var span = document.createElement('span');
            span.className = 'zone-tag fw-bold bg-light zone-tag-more';
            span.textContent = '+' + (items.length - visualLimit) + ' more';
            span.title = 'Click to search, view, and manage all ' + items.length + ' selected items';
            span.setAttribute('role', 'button');
            span.style.cursor = 'pointer';
            span.addEventListener('click', function (e) {
                e.stopPropagation();
                window.openClientTagModal(scope, field);
            });
            container.appendChild(span);
        }

        items.forEach(function (tag) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = field + '[]';
            input.value = tag.id;
            hiddenContainer.appendChild(input);
        });
        window.updateClientSelectAllLink(scope, field);
        // Lets a page react to the selection (e.g. Invoices re-reads the billing period).
        document.dispatchEvent(new CustomEvent('client-tags-change', { detail: { scope: scope, field: field } }));
    };

    window.openClientTagModal = function (scope, field) {
        var fieldLabel = 'Items';
        if (field === 'carriers' || field === 'carrier_ids') fieldLabel = 'Carriers';
        else if (field === 'modes') fieldLabel = 'Modes';
        else if (field === 'package_types') fieldLabel = 'Parcel Types';

        var link = document.getElementById(scope + '_' + field + '_selectAllLink');
        var listKey = link ? link.dataset.listKey : null;

        if (window.CRMUtils && typeof window.CRMUtils.openTagManagerModal === 'function') {
            window.CRMUtils.openTagManagerModal({
                title: fieldLabel,
                getItems: function () {
                    return (window.getClientTagScope(scope)[field] || []);
                },
                getAvailableItems: function () {
                    if (listKey && window.acDataLists && window.acDataLists[listKey]) {
                        return window.acDataLists[listKey];
                    }
                    return null;
                },
                onRemove: function (id) {
                    window.removeClientTag(scope, field, id);
                },
                onAdd: function (id, label) {
                    window.addClientTag(scope, field, id, label);
                },
                onSelectAll: function () {
                    if (listKey) {
                        var list = (window.acDataLists && window.acDataLists[listKey]) || [];
                        window.setClientTags(scope, field, list.map(function (item) {
                            return (typeof item === 'object') ? { id: String(item.id), label: item.label } : { id: String(item), label: String(item) };
                        }));
                    }
                },
                onDeselectAll: function () {
                    window.setClientTags(scope, field, []);
                }
            });
        }
    };

    window.toggleAllClientTags = function (scope, field, listKey) {
        var list = (window.acDataLists && window.acDataLists[listKey]) || [];
        var current = window.getClientTagScope(scope)[field] || [];
        var allSelected = list.length > 0 && list.every(function (item) {
            return current.some(function (t) { return String(t.id) === String(item.id || item); });
        });
        if (allSelected) {
            window.setClientTags(scope, field, []);
        } else {
            window.setClientTags(scope, field, list.map(function (item) {
                return (typeof item === 'object') ? { id: String(item.id), label: item.label } : { id: String(item), label: String(item) };
            }));
        }
    };

    window.updateClientSelectAllLink = function (scope, field) {
        var link = document.getElementById(scope + '_' + field + '_selectAllLink');
        if (!link) return;
        var listKey = link.dataset.listKey;
        var list = (window.acDataLists && window.acDataLists[listKey]) || [];
        var current = window.getClientTagScope(scope)[field] || [];
        var allSelected = list.length > 0 && list.every(function (item) {
            return current.some(function (t) { return String(t.id) === String(item.id || item); });
        });
        link.textContent = allSelected ? 'Deselect All' : 'Select All';
        link.style.display = list.length > 0 ? '' : 'none';
    };

    window.bindClientTagInput = function (inputId, scope, field) {
        var input = document.getElementById(inputId);
        if (!input) return;
        var container = input.closest('.zone-tag-container');
        if (container && !container.dataset.clickBound) {
            container.dataset.clickBound = '1';
            container.addEventListener('click', function () { input.focus(); });
        }
        if (input.dataset.acBound) return;
        input.dataset.acBound = '1';
        input.addEventListener('ac-select', function (e) {
            var item = e.detail.item;
            var id = (item && typeof item === 'object' && item.id !== undefined) ? item.id : e.detail.id;
            var label = (item && typeof item === 'object' && (item.label || item.name)) ? (item.label || item.name) : e.detail.label;
            window.addClientTag(scope, field, id, label);
            input.value = '';
        });
    };

    $(document).on('click', '.client-tag-remove', function (e) {
        e.stopPropagation();
        window.removeClientTag($(this).data('scope'), $(this).data('field'), String($(this).data('id')));
    });

    // ── Export what a client-side list shows ───────────────────────────────────
    // A list filtered in the browser (search box, Filters panel) exports only
    // the rows it matches, on every page of the table; an unfiltered list
    // exports everything. Returns the matched rows' `attr` values (e.g.
    // "data-id"), or null when nothing narrows the table.
    //   dts: one DataTables API or an array of them (tabbed lists).
    window.CRMExportKeys = function (dts, attr) {
        var narrowed = false, keys = [];
        [].concat(dts).forEach(function (dt) {
            if (!dt) return;
            var shown = dt.rows({ search: 'applied' });
            if (shown.count() < dt.rows().count()) narrowed = true;
            shown.nodes().each(function (tr) {
                var k = tr.getAttribute(attr);
                if (k !== null && k !== '') keys.push(k);
            });
        });
        return narrowed ? keys : null;
    };

    // Downloads `url` with `params`, adding `ids` (the CRMExportKeys result)
    // when the list is filtered. An empty match still sends ids="" so the
    // export is empty, like the list, rather than everything.
    window.CRMExportGo = function (url, params, ids) {
        var p = new URLSearchParams(params || {});
        if (ids) p.set('ids', ids.join(','));
        window.location = url + (url.indexOf('?') < 0 ? '?' : '&') + p.toString();
    };

    // ── Ctrl+P on an open document modal prints the document ──────────────────
    // The browser's own print of the page laid the modal out at 1100px on a
    // portrait page: the right side was cut off and a grey gap sat on top.
    // When a modal with its own Print button (cash memo, POD, ledger) is open,
    // Ctrl / Cmd + P presses that button instead, so the print is the designed one.
    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || String(e.key).toLowerCase() !== 'p') return;
        var modals = document.querySelectorAll('.modal.show');
        var modal = modals[modals.length - 1];
        var btn = modal && modal.querySelector('[onclick*="CRMPrint("], #btn-print-ledger');
        if (!btn) return;
        e.preventDefault();
        btn.click();
    }, true);

    // ── Print a designed document exactly as it is laid out ───────────────────
    // window.print() on the page printed the modal at a fixed 1100px, wider than
    // any A4 page, so the right side was cut off (and the phone-width modal
    // styles a printed page triggers moved it about). Instead the element is
    // copied into a hidden frame with every stylesheet of the page, laid out at
    // its design width and scaled to fit the printable width - nothing cropped,
    // nothing restyled.
    //   source: element or id.  opts.orientation 'landscape' (default) | 'portrait'
    //   opts.width: design width in px (default 1100)   opts.marginMm (default 6)
    //   opts.title: document title (the default PDF file name)
    window.CRMPrint = function (source, opts) {
        opts = opts || {};
        var el = typeof source === 'string' ? document.getElementById(source) : source;
        if (!el) {
            if (window.showToast) window.showToast('Nothing to print yet.', 'error');
            return;
        }
        var orientation = opts.orientation === 'portrait' ? 'portrait' : 'landscape';
        var designWidth = opts.width || 1100;
        var marginMm = opts.marginMm != null ? opts.marginMm : 6;
        // 2mm short of the printable width: fitted exactly, the document's outer
        // border sat on the edge of the printable area and Chrome's print
        // preview clipped it (right border and corner missing).
        var printableMm = (orientation === 'landscape' ? 297 : 210) - 2 * marginMm - 2;
        var zoom = Math.min(1, (printableMm * 96 / 25.4) / designWidth);

        var clone = el.cloneNode(true);
        clone.removeAttribute('id');
        // Canvas drawings don't survive cloning: carry them over as images.
        var srcCanvases = el.querySelectorAll('canvas');
        clone.querySelectorAll('canvas').forEach(function (c, i) {
            try {
                var img = document.createElement('img');
                img.src = srcCanvases[i].toDataURL('image/png');
                img.style.cssText = c.style.cssText;
                img.width = c.width; img.height = c.height;
                c.parentNode.replaceChild(img, c);
            } catch (e) { /* tainted canvas: leave it */ }
        });
        // Typed / chosen values live in properties, not in the markup.
        var srcFields = el.querySelectorAll('input, select, textarea');
        clone.querySelectorAll('input, select, textarea').forEach(function (f, i) {
            var s = srcFields[i];
            if (!s) return;
            if (f.tagName === 'SELECT') {
                Array.prototype.forEach.call(f.options, function (o, j) { if (s.options[j] && s.options[j].selected) o.setAttribute('selected', 'selected'); else o.removeAttribute('selected'); });
            } else if (f.type === 'checkbox' || f.type === 'radio') {
                if (s.checked) f.setAttribute('checked', 'checked'); else f.removeAttribute('checked');
            } else if (f.tagName === 'TEXTAREA') {
                f.textContent = s.value;
            } else {
                f.setAttribute('value', s.value);
            }
        });
        clone.querySelectorAll('.no-print').forEach(function (n) { n.parentNode.removeChild(n); });

        // Every stylesheet the page uses (custom.css, page <style> blocks, ...).
        var styles = '';
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(function (n) { styles += n.outerHTML; });

        var frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(frame);

        // #crmPrintRoot repeated: outranks the page's own print rules that hide
        // everything but specific modals (custom.css section 37). That rule's
        // :not(#a):not(#b)... list counts one id per modal, so keep headroom: at
        // 4 repeats it won once a 4th modal was listed and printed a blank page.
        var R = '#crmPrintRoot#crmPrintRoot#crmPrintRoot#crmPrintRoot#crmPrintRoot#crmPrintRoot#crmPrintRoot#crmPrintRoot';
        var css =
            '@page { size: A4 ' + orientation + '; margin: ' + marginMm + 'mm; }' +
            'html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; width: auto !important; overflow: visible !important; }' +
            'body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }' +
            'body > ' + R + ' { display: block !important; visibility: visible !important; position: static !important;' +
            ' width: ' + designWidth + 'px !important; max-width: none !important; zoom: ' + zoom.toFixed(4) + '; margin: 0 !important; }' +
            R + ' .memo-fixed-wrapper, ' + R + ' .memo-container, ' + R + ' .pod-doc { width: 100% !important; max-width: none !important; margin: 0 !important; box-shadow: none !important; }' +
            R + ' .modal-body { padding: 0 !important; overflow: visible !important; max-height: none !important; }' +
            R + ' tr, ' + R + ' .pod-grid-row, ' + R + ' .pod-party-row, ' + R + ' .pod-sig-row, ' + R + ' img, ' + R + ' svg { break-inside: avoid; page-break-inside: avoid; }';

        var doc = frame.contentWindow.document;
        doc.open();
        doc.write('<!DOCTYPE html><html><head><meta charset="utf-8"><base href="' + document.baseURI + '">' +
            '<title>' + String(opts.title || document.title).replace(/</g, '&lt;') + '</title>' +
            styles + '<style>' + css + '</style></head><body>' +
            '<div id="crmPrintRoot" class="' + (opts.rootClass || '') + '"></div></body></html>');
        doc.close();
        doc.getElementById('crmPrintRoot').appendChild(doc.importNode(clone, true));

        var printed = false;
        var cleanup = function () { setTimeout(function () { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 500); };
        var go = function () {
            if (printed) return;
            printed = true;
            // Images (logo, signature, proof photo) and web fonts first.
            var imgs = Array.prototype.slice.call(doc.images);
            var waits = imgs.filter(function (i) { return !i.complete; }).map(function (i) {
                return new Promise(function (res) { i.onload = i.onerror = res; });
            });
            Array.prototype.forEach.call(doc.querySelectorAll('link[rel="stylesheet"]'), function (l) {
                var loaded = false;
                try { loaded = !!(l.sheet && l.sheet.cssRules); } catch (e) { loaded = !!l.sheet; }
                if (!loaded) waits.push(new Promise(function (res) { l.addEventListener('load', res); l.addEventListener('error', res); }));
            });
            if (doc.fonts && doc.fonts.ready) waits.push(doc.fonts.ready);
            Promise.race([Promise.all(waits), new Promise(function (res) { setTimeout(res, 4000); })]).then(function () {
                var w = frame.contentWindow;
                w.addEventListener('afterprint', cleanup);
                w.focus();
                w.print();
                // Browsers without afterprint in frames: remove it a minute later.
                setTimeout(cleanup, 60000);
            });
        };
        // Let the frame lay out, then wait for its stylesheets, images and fonts.
        setTimeout(go, 300);
    };

    // ── List toolbars: Filters right before Search ───────────────────────
    // Every list page reads: tabs / title · page actions · Import · Export ·
    // Filters · Search. A Filters button comes from the page's own markup or
    // from list-sort.js once its table initialises, so this runs on load and
    // again after every DataTable init. Idempotent.
    function placeFilters() {
        document.querySelectorAll('.bk-tools').forEach(function (bar) {
            var search = null;
            // The first one: tabbed lists (Expenses) keep a search slot per tab.
            Array.prototype.forEach.call(bar.children, function (el) {
                if (!search && el.classList.contains('list-search-wrap')) search = el;
            });
            Array.prototype.filter.call(bar.children, function (el) {
                return /^(BUTTON|A)$/.test(el.tagName) && el.querySelector('.fa-filter');
            }).forEach(function (btn) {
                if (search) {
                    bar.insertBefore(btn, search);
                    // The push to the right moves with it, so Filters and Search stay together.
                    if (search.classList.contains('ms-auto')) {
                        search.classList.remove('ms-auto');
                        btn.classList.add('ms-auto');
                    }
                } else {
                    bar.appendChild(btn);
                }
            });
        });
    }
    window.placeListFilters = placeFilters;
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeFilters);
    else placeFilters();
    if ($) $(document).on('init.dt', function () { setTimeout(placeFilters, 120); });

})(window, window.jQuery);
