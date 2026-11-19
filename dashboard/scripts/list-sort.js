/*
 * Filters → Sort By (with a ▲ Descending / ▼ Ascending toggle) for every DataTable list.
 *
 * Lists start in the order the server sends them (newest first; the POD page
 * and config master data use their own default). This adds a "Columns"
 * (show / hide) field, then a "Sort By" column picker and an
 * Ascending/Descending picker to the list's filter panel - or
 * adds a Filters button and panel when the page has none - and orders the
 * table through the DataTables API as soon as a choice is made. The choice is
 * remembered per user and table until changed. Headers stay non-clickable
 * (see datatable-extension/custom.js).
 *
 * Opt-outs: tables inside a .modal, or marked data-no-list-sort.
 * A table with its own default order sets data-default-sort-label (shown in
 * place of "Most Recent").
 */
(function ($) {
  "use strict";
  if (!$ || !$.fn.dataTable) return;

  // ── Browser-side sorting of dd/mm/yyyy dates and ₹ amounts ──────────────
  var DMY = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})\s*([AaPp][Mm])?)?/;
  function textOf(d) { return typeof d === "string" ? $("<div>").html(d).text() : String(d == null ? "" : d); }
  $.fn.dataTable.ext.type.detect.unshift(function (d) {
    var t = textOf(d).trim();
    return t === "" || DMY.test(t) ? "dmy" : null;
  });
  $.fn.dataTable.ext.type.order["dmy-pre"] = function (d) {
    var m = DMY.exec(textOf(d));
    if (!m) return 0;
    var h = m[4] ? parseInt(m[4], 10) % 12 + (/p/i.test(m[6] || "") ? 12 : 0) : 0;
    return Number(m[3] + ("0" + m[2]).slice(-2) + ("0" + m[1]).slice(-2) + ("0" + h).slice(-2) + (m[5] || "00"));
  };
  var RUPEE = /^\s*-?\s*₹\s*-?[\d,]+(\.\d+)?/;
  $.fn.dataTable.ext.type.detect.unshift(function (d) {
    var t = textOf(d).trim();
    return t === "" || RUPEE.test(t) ? "rupee" : null;
  });
  $.fn.dataTable.ext.type.order["rupee-pre"] = function (d) {
    var t = textOf(d).replace(/[^\d.\-]/g, "");
    return t === "" ? -Infinity : parseFloat(t);
  };

  // ── Panels ──────────────────────────────────────────────────────────────
  var seq = 0;
  window.acDataLists = window.acDataLists || {};

  // ▲ = Descending, ▼ = Ascending; the active one is highlighted.
  function setDir($row, dir) {
    dir = dir === "asc" ? "asc" : "desc";
    $row.find(".list-sort-dir").val(dir);
    $row.find(".list-sort-dir-btn").each(function () {
      var on = $(this).data("dir") === dir;
      $(this).toggleClass("active", on).attr("aria-pressed", on ? "true" : "false");
    });
  }

  function headerText(api, i) {
    return $.trim($(api.column(i).header()).clone().find(".dtr-control,.dt-hide").remove().end().text()).replace(/\s+/g, " ");
  }

  // Columns a user can sort this table by. Server-side tables only offer the
  // columns their endpoint reports as sortable (json.orderable).
  function sortableColumns(api) {
    var settings = api.settings()[0];
    var serverSide = settings.oFeatures.bServerSide;
    var allowed = serverSide && settings.json && $.isArray(settings.json.orderable)
      ? settings.json.orderable.map(Number) : null;
    var cols = [];
    api.columns().every(function (i) {
      var label = headerText(api, i);
      if (!label || /^(actions?|#|sr\.?\s*no\.?|s\.?\s*no\.?)$/i.test(label)) return;
      if ($(this.header()).is("[data-no-sort]")) return;
      if (!this.visible()) return; // hidden (export-only or user-hidden) columns
      if (serverSide && (!allowed || allowed.indexOf(i) === -1)) return;
      cols.push({ label: label, id: String(i) });
    });
    return cols;
  }

  // The table this panel currently controls: the visible one among its tables.
  function activeApi($panel) {
    var apis = $panel.data("listSortApis") || [];
    for (var i = 0; i < apis.length; i++) {
      if ($(apis[i].table().node()).is(":visible")) return apis[i];
    }
    return apis[0];
  }

  function defaultLabel(api) {
    return $(api.table().node()).attr("data-default-sort-label")
      // Config master lists default to their Sort Order, the rest to newest first.
      || (/^\/config\//.test(location.pathname) ? "Default Order" : "Most Recent");
  }

  // The table's colvis ("Columns") button - from the page's own buttons or the
  // app-wide one (datatable-extension/custom.js) - moves out of the toolbar into
  // the panel's Columns field. The button keeps its page's column rules, and its
  // dropdown opens right under it (Buttons positions it from the button).
  function moveColvis(api, $panel) {
    if (typeof api.buttons !== "function") return;
    var $btn = $(api.buttons().nodes()).filter(".buttons-colvis").first();
    if (!$btn.length) return;
    var $group = $btn.parent();
    $btn.data("listColsTable", api.table().node())
      .attr("type", "button") // it now sits inside the filter <form>
      .removeClass("btn-sm")
      .addClass("form-control list-cols-btn")
      .html('<span><i class="fa fa-columns"></i> Show / Hide</span><i class="fa fa-angle-down"></i>')
      .appendTo($panel.find(".list-cols-slot").first());
    if (!$group.children().length) $group.addClass("list-cols-empty");
    $panel.find(".list-cols-field").removeClass("d-none");
  }

  // Only the visible table's Columns button shows (tabbed lists share a panel).
  function syncColvis($panel, api) {
    $panel.find(".list-cols-btn").each(function () {
      $(this).toggleClass("list-cols-inactive", $(this).data("listColsTable") !== api.table().node());
    });
  }

  function refreshOptions($panel) {
    var api = activeApi($panel);
    if (!api) return;
    syncColvis($panel, api);
    var key = $panel.data("listSortKey");
    window.acDataLists[key] = [{ label: defaultLabel(api), id: "" }].concat(sortableColumns(api));
    // Show the active table's current sort.
    var ord = api.order();
    var $row = $panel.find(".list-sort-row");
    if (ord.length) {
      var col = String(ord[0][0]);
      var item = window.acDataLists[key].filter(function (o) { return o.id === col; })[0];
      $row.find(".list-sort-col-ac").val(item ? item.label : "");
      $row.find(".list-sort-col").val(item ? col : "");
      setDir($row, ord[0][1]);
    } else {
      $row.find(".list-sort-col-ac").val(defaultLabel(api)).attr("placeholder", defaultLabel(api));
      $row.find(".list-sort-col").val("");
    }
  }

  // A chosen sort is remembered per user, page and table, and applied on every
  // visit until the user picks another one (or "Most Recent" to go back to the
  // default). Filter / Reset of the other filters leave it alone.
  var userId = $('meta[name="user-id"]').attr("content") || "0";
  function storeKey(api) {
    return "listSort:u" + userId + ":" + location.pathname + ":" + ($(api.table().node()).attr("id") || "");
  }
  function store(api, col, dir) {
    try {
      if (col === "") localStorage.removeItem(storeKey(api));
      else localStorage.setItem(storeKey(api), JSON.stringify({ col: col, dir: dir }));
    } catch (e) {}
  }
  function stored(api) {
    try { return JSON.parse(localStorage.getItem(storeKey(api)) || "null"); } catch (e) { return null; }
  }

  function apply($panel) {
    var api = activeApi($panel);
    if (!api) return;
    var $row = $panel.find(".list-sort-row");
    var col = $row.find(".list-sort-col").val();
    var dir = $row.find(".list-sort-dir").val() === "asc" ? "asc" : "desc";
    $row.data("applied", col !== "");
    api.order(col === "" ? [] : [[parseInt(col, 10), dir]]).draw();
    updateBadge($panel, col !== "");
    store(api, col, dir);
  }

  function updateBadge($panel, active) {
    var $toggle = $panel.data("listSortToggle");
    if (!$toggle || !$toggle.length) return;
    $toggle.toggleClass("active", !!active).find(".list-sort-count").remove();
    if (active) $toggle.append('<span class="bk-filter-count list-sort-count">1</span>');
  }

  // ── Column filters declared in a page's panel (partials/list-filter-panel) ──
  // A field with data-col-filter="<column>" filters that column of the table in
  // the browser: contains, or the whole cell with data-col-match="exact". Filter
  // applies them, Reset clears them; values already filled in (a GET form
  // reloaded with them) apply as soon as the table is ready.
  function escapeRe(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function bindColFilters($panel, api) {
    var $fields = $panel.find("[data-col-filter]");
    if (!$fields.length || $panel.data("colFiltersBound")) return;
    $panel.data("colFiltersBound", true);
    function run() {
      var active = 0;
      // Every table sharing the panel (tabbed lists), so a tab switch keeps the filter.
      var apis = $panel.data("listSortApis") || [api];
      // Fields can share a column (Users: Role and Branch are one cell), so the
      // patterns are gathered per column and must all match.
      var byCol = {};
      $fields.each(function () {
        var v = $.trim($(this).val() || "");
        var col = parseInt($(this).attr("data-col-filter"), 10);
        byCol[col] = byCol[col] || [];
        if (v === "") return;
        active++;
        byCol[col].push($(this).attr("data-col-match") === "exact"
          ? "^\\s*" + escapeRe(v) + "\\s*$"
          : escapeRe(v));
      });
      Object.keys(byCol).forEach(function (col) {
        var p = byCol[col];
        var re = !p.length ? "" : p.length === 1 ? p[0]
          : "^" + p.map(function (x) { return "(?=" + (x.charAt(0) === "^" ? x.slice(1) : "[\\s\\S]*" + x) + ")"; }).join("");
        apis.forEach(function (a) { a.column(parseInt(col, 10)).search(re, true, false, true); });
      });
      apis.forEach(function (a) { a.draw(); });
      var $toggle = $panel.data("listSortToggle");
      if ($toggle && $toggle.length) {
        $toggle.find(".col-filter-count").remove();
        if (active) $toggle.addClass("active").append('<span class="bk-filter-count col-filter-count">' + active + "</span>");
      }
    }
    $panel.on("click", ".filter-btn-apply", run);
    $panel.on("click", ".filter-btn-reset", function (e) {
      if (this.tagName === "A") return; // a GET form's Reset reloads the page
      $fields.each(function () {
        $(this).val("");
        $(this).siblings(".custom-ac").val("");
      });
      run();
    });
    $fields.filter("input[type=text], input:not([type])").on("keyup", function (e) { if (e.key === "Enter") run(); });
    if ($fields.filter(function () { return $.trim($(this).val() || "") !== ""; }).length) setTimeout(run, 0);
  }

  // The Sort By field: the column picker with the ▲/▼ direction toggle beside
  // it, in one input group (one cell instead of a separate Order field).
  var FIELD_COL = "col-md-2 col-sm-6 col-12";
  function sortColsHtml(key) {
    return '' +
      '<div class="' + FIELD_COL + ' list-sort-field">' +
      '  <label class="form-label">Sort By</label>' +
      '  <div class="input-group list-sort-group">' +
      '    <input type="text" class="form-control custom-ac list-sort-col-ac" data-ac-list="' + key + '" autocomplete="off">' +
      '    <span class="list-sort-dirs" role="group" aria-label="Sort order">' +
      '      <button type="button" class="list-sort-dir-btn active" data-dir="desc" title="Descending" aria-pressed="true"><i class="fa fa-chevron-up"></i></button>' +
      '      <button type="button" class="list-sort-dir-btn" data-dir="asc" title="Ascending" aria-pressed="false"><i class="fa fa-chevron-down"></i></button>' +
      '    </span>' +
      '  </div>' +
      '  <input type="hidden" class="list-sort-col" value="">' +
      '  <input type="hidden" class="list-sort-dir" value="desc">' +
      '</div>';
  }

  // Every field of a filter panel gets the same width (col-md-2; two per row
  // on small screens, one on phones). The Filter/Reset cell is left alone.
  function equalizeFields($panel) {
    if ($panel.data("listSortEqualized")) return;
    $panel.data("listSortEqualized", true);
    // A panel written as several stacked rows becomes one row, so the equal
    // fields flow line after line and Filter/Reset end the last line.
    $panel.find(".row").filter(function () { return !$(this).parent().closest(".row", $panel[0]).length; }).each(function () {
      var $first = $(this).prevAll(".row").last();
      if ($first.length) { $first.append($(this).children()); $(this).remove(); }
    });
    $panel.find(".row").each(function () {
      $(this).children().each(function () {
        var $c = $(this);
        if ($c.hasClass("filter-actions") || !/\bcol\b|\bcol-/.test(this.className) || !$c.find("label").length) return;
        $c.attr("class", (this.className.replace(/\bcol(-[a-z]+)?(-\d+|-auto)?\b/g, "").replace(/\s+/g, " ").trim() + " " + FIELD_COL).trim());
      });
    });
  }
  // The Columns field (show / hide columns), just before Sort By. It holds the
  // table's own colvis button, moved here from the toolbar (see moveColvis).
  function colsFieldHtml() {
    return '' +
      '<div class="' + FIELD_COL + ' list-cols-field d-none">' +
      '  <label class="form-label">Columns</label>' +
      '  <div class="list-cols-slot"></div>' +
      '</div>';
  }

  // A panel of its own (lists without filters): the sort fields + Filter/Reset.
  function sortRowHtml(key) {
    return '' +
      '<div class="row g-2 align-items-end list-sort-row">' +
      colsFieldHtml() +
      sortColsHtml(key) +
      '  <div class="col filter-actions">' +
      '    <button type="button" class="btn btn-premium filter-btn-icon filter-btn-apply list-sort-apply" title="Apply Filter"><i class="icofont icofont-search"></i> <span>Filter</span></button>' +
      '    <button type="button" class="btn btn-light filter-btn-icon filter-btn-reset list-sort-reset" title="Clear Filter"><i class="icofont icofont-refresh"></i> <span>Reset</span></button>' +
      '  </div>' +
      '</div>';
  }

  // An existing filter panel: the sort fields join its row just before the
  // Filter/Reset column, sized like the panel's other fields, and that column
  // becomes the row's flexible last cell (right-aligned, wraps whole when the
  // line is too short). Panels without a .filter-actions column get a row.
  function addSortFields($panel, key) {
    var $actions = $panel.find(".filter-actions").first();
    if (!$actions.length) {
      $panel.append($(sortRowHtml(key)).find(".filter-actions").remove().end().addClass("mt-1"));
      return;
    }
    $(colsFieldHtml() + sortColsHtml(key)).insertBefore($actions);
    $actions.closest(".row").addClass("list-sort-row");
    $actions.attr("class", ($actions.attr("class") || "")
      .replace(/\b(ms-auto|mt-\d)\b/g, "")
      .replace(/\bcol(-[a-z]+)?(-\d+|-auto)?\b/g, "")
      .replace(/\s+/g, " ").trim() + " col");
  }

  // Find (or build) the filter panel for a table's card.
  function panelFor(api) {
    var $table = $(api.table().node());
    var $wrapper = $(api.table().container());
    var $card = $wrapper.closest(".card, .list-card, .sa-card");
    if (!$card.length) $card = $wrapper.parent();

    var $panel = $card.find(".filter-panel").first();
    if ($panel.length) {
      if (!$panel.data("listSortKey")) {
        var key = "list_sort_cols_" + (++seq);
        $panel.data("listSortKey", key).data("listSortApis", []);
        equalizeFields($panel);
        addSortFields($panel, key);
        var target = $panel.closest(".collapse").attr("id");
        $panel.data("listSortToggle", target ? $('[data-bs-target="#' + target + '"], [href="#' + target + '"][data-bs-toggle="collapse"]').first() : $());
      }
      return $panel;
    }

    // No filter panel on this list: add a Filters button and panel.
    var id = "listFilter" + (++seq);
    var key2 = "list_sort_cols_" + seq;
    var $collapse = $('<div class="collapse list-filter-collapse" id="' + id + '"><div class="filter-panel">' + sortRowHtml(key2, true) + "</div></div>");
    var $toggle = $('<button type="button" class="btn btn-outline-secondary flex-shrink-0 list-filter-toggle" data-bs-toggle="collapse" data-bs-target="#' + id + '" aria-expanded="false" aria-controls="' + id + '">' +
      '<i class="fa fa-filter"></i> <span class="btn-label">Filters</span></button>');

    var $toolbar = $card.find(".bk-toolbar").first();
    if ($toolbar.length) {
      $collapse.insertAfter($toolbar);
      var $tools = $toolbar.find(".bk-tools").first();
      ($tools.length ? $tools : $toolbar).prepend($toggle);
    } else {
      $collapse.insertBefore($wrapper);
      var $btns = $wrapper.find(".dt-buttons").first();
      if ($btns.length) {
        $btns.prepend($toggle.removeClass("btn-outline-secondary").addClass("btn btn-outline-secondary"));
      } else {
        $('<div class="list-filter-bar"></div>').append($toggle).insertBefore($collapse);
      }
    }
    $panel = $collapse.find(".filter-panel");
    $panel.data("listSortKey", key2).data("listSortApis", []).data("listSortToggle", $toggle);
    return $panel;
  }

  function attach(api) {
    var $table = $(api.table().node());
    if ($table.data("listSortBound") || $table.is("[data-no-list-sort]") || $table.closest(".modal").length) return;
    $table.data("listSortBound", true);

    var $panel = panelFor(api);
    bindColFilters($panel, api);
    $panel.data("listSortApis").push(api);
    moveColvis(api, $panel);

    // Bring back the sort chosen before this page's own Filter submit.
    var saved = stored(api);
    if (saved && saved.col !== "") {
      var $r = $panel.find(".list-sort-row");
      $r.data("applied", true);
      $r.find(".list-sort-col").val(saved.col);
      setDir($r, saved.dir);
      // Deferred: a redraw requested inside the init event is dropped for server tables.
      setTimeout(function () { api.order([[parseInt(saved.col, 10), saved.dir === "asc" ? "asc" : "desc"]]).draw(); }, 0);
      updateBadge($panel, true);
    }
    refreshOptions($panel);

    // Server tables learn their sortable columns from the first response.
    api.on("xhr.dt", function () { setTimeout(function () { refreshOptions($panel); }, 0); });
    // Sort By offers visible columns only, so follow Columns show / hide.
    api.on("column-visibility.dt", function () { refreshOptions($panel); });
    $panel.closest(".collapse").on("show.bs.collapse", function () { refreshOptions($panel); });
    // Tabs switching between tables that share this panel.
    $(document).on("shown.bs.tab", function () { refreshOptions($panel); });

    if (!$panel.data("listSortEventsBound")) {
      $panel.data("listSortEventsBound", true);
      var $row = $panel.find(".list-sort-row");
      $row.find(".list-sort-col-ac").on("ac-select", function (e) {
        var item = (e.originalEvent && e.originalEvent.detail && e.originalEvent.detail.item) || {};
        $row.find(".list-sort-col").val(item.id || "");
        apply($panel);
      });
      $row.find(".list-sort-dir-btn").on("click", function () {
        setDir($row, $(this).data("dir"));
        if ($row.find(".list-sort-col").val() !== "") apply($panel);
      });
      $row.find(".list-sort-apply").on("click", function () { apply($panel); });
      $row.find(".list-sort-reset").on("click", function () {
        $row.find(".list-sort-col").val("");
        setDir($row, "desc");
        apply($panel);
        refreshOptions($panel);
      });
    }
  }

  $(function () { $(".filter-panel").each(function () { equalizeFields($(this)); }); });

  $(document).on("init.dt", function (e, settings) {
    if (e.namespace !== "dt") return;
    attach(new $.fn.dataTable.Api(settings));
  });
})(window.jQuery);
