(() => {
  const os = document.querySelector(".os");
  const layer = document.querySelector(".command-layer");
  const field = document.querySelector("#command-query");
  const dock = document.querySelector("#composer-query");
  const reopen = document.querySelector("[data-reopen-sidebar]");

  const openCommand = () => {
    if (!layer) return;
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    window.setTimeout(() => field?.focus(), 0);
  };

  const closeCommand = () => {
    if (!layer) return;
    if (document.body.classList.contains("artifact-command")) return;
    layer.classList.remove("is-open");
    layer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const toggleSidebar = () => {
    os?.classList.toggle("sidebar-collapsed");
    const collapsed = os?.classList.contains("sidebar-collapsed");
    document.querySelectorAll("[data-collapse]").forEach((btn) => {
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  };

  document.querySelectorAll("[data-open-command]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if (el.tagName === "A" && el.getAttribute("href") === "#command") {
        event.preventDefault();
      }
      openCommand();
    });
  });

  document.querySelectorAll("[data-close-command]").forEach((el) => {
    el.addEventListener("click", closeCommand);
  });

  layer?.addEventListener("click", (event) => {
    if (event.target === layer) closeCommand();
  });

  document.querySelectorAll("[data-collapse]").forEach((el) => {
    el.addEventListener("click", toggleSidebar);
  });

  reopen?.addEventListener("click", toggleSidebar);

  document.addEventListener("keydown", (event) => {
    const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (metaK) {
      event.preventDefault();
      if (layer?.classList.contains("is-open") || document.body.classList.contains("artifact-command")) {
        closeCommand();
        dock?.focus();
      } else {
        openCommand();
      }
    }
    if (event.key === "Escape") {
      if (layer?.classList.contains("is-open") && !document.body.classList.contains("artifact-command")) {
        closeCommand();
        return;
      }
      const inspector = document.querySelector(".os--inspector");
      if (inspector && window.matchMedia("(max-width: 1024px)").matches) {
        window.location.href = "shell.html";
      }
    }
  });

  if (document.body.classList.contains("artifact-command")) {
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }
})();
