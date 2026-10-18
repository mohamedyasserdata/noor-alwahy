(function () {
  try {
    var savedTheme = localStorage.getItem("noor-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = savedTheme === "dark" || (savedTheme !== "light" && prefersDark);

    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", isDark ? "#091a33" : "#faf6ec");
  } catch {
    // The light theme remains usable when storage or matchMedia is unavailable.
  }
})();
