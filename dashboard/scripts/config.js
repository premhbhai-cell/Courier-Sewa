(function () {
  var primary = localStorage.getItem("primary") || "#006666";
  var secondary = localStorage.getItem("secondary") || "#BD362F";

  window.RihoAdminConfig = {
    // Theme Primary Color
    primary: primary,
    // theme secondary color
    secondary: secondary,
  };
})();
