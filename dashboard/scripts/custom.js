// Drops the search terms and page position from a saved DataTables state.
window.esecrmResetDtSearchState = function (data) {
  if (!data) return;
  if (data.search) data.search.search = "";
  data.start = 0;
  (data.columns || []).forEach(function (c) { if (c && c.search) c.search.search = ""; });
};

(function ($) {
  "use strict";

  // Real, app-wide behaviour (everything below this block is unused vendor
  // demo boilerplate — its selectors target theme-showcase ids that don't
  // exist on any real page, so it just no-ops here).

  // ── Column show/hide + responsive mobile collapsing, for every table ──
  // Applied via DataTables' own defaults object, which every .DataTable()
  // call across the app reads at construction time — no per-page wiring
  // needed. `responsive: true` lets narrow (mobile) screens auto-collapse
  // lower-priority columns into an expandable "+" row; `stateSave` (backed
  // by localStorage, no expiry) remembers each user's own column
  // show/hide choices, per table, in their browser.
  if ($.fn.dataTable) {
    $.extend(true, $.fn.dataTable.defaults, {
      responsive: true,
      stateSave: true,
      stateDuration: -1,
      // Ordering is on, but with no initial order: rows show in the order the
      // server sends them (newest first). Users change it from Filters → Sort By
      // (list-sort.js); header cells stay non-clickable (column default below).
      ordering: true,
      order: [],
      // Search, paging and sort start fresh on every page load (filters reset
      // on reload); only the saved column show/hide choices are restored.
      stateLoadParams: function (settings, data) {
        delete data.order;
        window.esecrmResetDtSearchState(data);
      },
    });
    // Headers aren't click-to-sort; the API (Sort By) still orders any column.
    $.fn.dataTable.defaults.column.bSortable = false;
  }

  // The responsive "+" in a column of its own on every list, like Bookings'
  // "#" column. A table whose first column is data gets a 44px "#" gutter at
  // the left of that column (custom.css "dt-gutter") holding the "+", so no
  // column is added and every page's column numbers (filters, exports, sort)
  // stay as they are. Tables in modals, and data-no-gutter tables, are left alone.
  $(document).on("preInit.dt", function (e, settings) {
    if (e.namespace !== "dt") return;
    var $table = $(settings.nTable);
    var $first = $table.find("> thead > tr:first > th:first");
    if (!$first.length || $first.is(".control, .dtr-col-control") || $table.is("[data-no-gutter]") || $table.closest(".modal").length) return;
    $table.addClass("dt-gutter");
    // A serial-number first column headed "#" would read "# #" next to the gutter.
    if ($.trim($first.text()) === "#") $first.text("S.No.");
  });

  // DataTables' own "B" (Buttons) dom-token renders extra toolbar buttons on
  // their own row above the table. Every list page also has a hand-coded
  // Filter toggle button in a `.head-options` div right above that. Move any
  // such buttons to sit next to it instead (Export CSV, and the new Columns
  // picker below), so all toolbar controls share one row — fires on every
  // DataTable init, so it works regardless of which page/table sets it up.
  $(document).on("init.dt", function (e, settings) {
    var api = new $.fn.dataTable.Api(settings);
    var $wrapper = $(settings.nTableWrapper);
    if (!$wrapper.length) return;

    // Responsive rows: opening one row's details (the + icon) closes any other
    // row open in the same table. Responsive fires this with triggerHandler (no
    // bubbling), so it has to be bound on each table, not on document.
    if (!$(settings.nTable).data("one-open-bound")) $(settings.nTable).data("one-open-bound", true).on("responsive-display.dt", function (e, dt, row, showHide) {
      if (!showHide) return;
      var opened = row.node();
      $(dt.table().body()).children("tr.parent").not(opened).each(function () {
        var other = dt.row(this);
        if (other.child.isShown()) other.child.hide();
        $(this).removeClass("parent");
      });
    });

    // Control column (#) and Action column stay visible on narrow screens
    var colCount = api.columns().count();
    if (colCount > 0) {
      var lastIdx = colCount - 1;
      $(api.column(lastIdx).header()).attr("data-priority", 1);
      $(api.column(0).header()).attr("data-priority", 1);
      if (colCount > 2) {
        $(api.column(1).header()).attr("data-priority", 2);
      }
    }
    if (api.responsive && typeof api.responsive.recalc === "function") {
      api.responsive.recalc();
    }

    // list-sort.js then moves this (or the page's own) Columns button into the
    // list's Filters panel, just before Sort By.
    if (!$wrapper.data("colvis-added") && $.fn.dataTable.Buttons) {
      $wrapper.data("colvis-added", true);
      var buttons = new $.fn.dataTable.Buttons(api, {
        buttons: [
          {
            extend: "colvis",
            text: '<i class="fa fa-columns me-sm-1"></i><span class="btn-label d-none d-sm-inline-block">Columns</span>',
            className: "btn btn-outline-secondary btn-sm",
            columns: ":not(:first-child):not(:last-child)",
            attr: {
              "data-bs-auto-close": "outside"
            }
          },
        ],
      });
      $(buttons.container()).appendTo($wrapper.get(0));
    }

    function moveButtons() {
      var $buttons = $wrapper.find("> .dt-buttons");
      if (!$buttons.length || $buttons.data("repositioned")) return;
      var $headOptions = $(".head-options").first();
      if (!$headOptions.length) {
        // Pages with no Filter toggle have no `.head-options` div for the
        // buttons to relocate into, so they're left in DataTables' own
        // default spot (which can end up wrapping below the table). Create
        // a minimal one right above the table so Export/Columns always land
        // in a consistent single row, same as pages that do have a Filter.
        $headOptions = $('<div class="head-options mb-3"></div>').insertBefore($wrapper);
      }
      $headOptions.addClass("d-flex align-items-center flex-nowrap gap-2");

      // Some pages (e.g. POD's Self/Third-Party Carrier tabs) run a
      // separate <table>+DataTable per Bootstrap tab-pane but share one
      // page-level .head-options bar. Moving every tab's buttons in there
      // detaches them from the tab-pane's own show/hide, so without this
      // they all pile up together instead of only the active tab's set
      // being visible. Tag the group with its pane id and hide it up front
      // if that pane isn't the active one; the shown.bs.tab handler below
      // then toggles visibility as the user switches tabs.
      var $tabPane = $wrapper.closest(".tab-pane");
      if ($tabPane.length) {
        $buttons.attr("data-dt-tab-pane", $tabPane.attr("id"));
        if (!$tabPane.hasClass("active")) $buttons.addClass("dt-pane-hidden");
      }

      var $searchSlot = $headOptions.find(".list-search-wrap");
      if ($searchSlot.length) {
        $buttons.data("repositioned", true).insertBefore($searchSlot);
      } else {
        $buttons.data("repositioned", true).appendTo($headOptions);
      }
    }
    // The Buttons extension can finish injecting its DOM a tick after
    // init.dt fires, so try immediately and once more shortly after.
    moveButtons();
    setTimeout(moveButtons, 50);
  });

  // Keep each tab-pane's relocated Export/Columns button group (tagged
  // above) in sync with Bootstrap tab switches — only the active pane's
  // group should be visible in the shared .head-options bar.
  $(document).on("shown.bs.tab", '[data-bs-toggle="tab"]', function (e) {
    var target = $(e.target).attr("data-bs-target") || $(e.target).attr("href");
    if (!target) return;
    var paneId = target.replace("#", "");
    // A class, not .toggle(): page CSS sets `.dt-buttons { display: inline-flex
    // !important }`, which beats jQuery's inline display:none - both tabs' Export /
    // Columns groups then stayed visible side by side.
    $("[data-dt-tab-pane]").each(function () {
      $(this).toggleClass("dt-pane-hidden", $(this).attr("data-dt-tab-pane") !== paneId);
    });
  });

  // Prevent Bootstrap from closing the column visibility dropdown when an option is clicked
  $('body').on('click', '.dt-button-collection', function (e) {
    e.stopPropagation();
  });

  // NOTE: ~260 lines of vendor theme-demo DataTables setup used to follow
  // here (#auto-fill, #export-button, #basic-colreorder, …). Every one of
  // those 28 selectors targets a theme-showcase id that exists on no page
  // in this app, so the block only ever no-oped — and it was the sole
  // reason the autoFill / select / keyTable / colReorder / fixedHeader /
  // rowReorder / scroller / jszip / pdfmake extensions were being loaded.
})(jQuery);
