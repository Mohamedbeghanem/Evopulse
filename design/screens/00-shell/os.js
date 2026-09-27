(() => {
  const os = document.querySelector(".os");
  const layer = document.querySelector(".command-layer");
  const field = document.querySelector("#command-query");
  const dock = document.querySelector("#composer-query");
  const active = os?.dataset.active || "pulse";

  const ICONS = {
    plus: '<path d="M8 3v10M3 8h10" />',
    search: '<circle cx="7" cy="7" r="4.2" /><path d="m13 13-3-3" />',
    pulse: '<path d="M3 9.5 8 3.5l5 6" /><path d="M5 8.5V13h6V8.5" />',
    command: '<path d="M3 12.5 6.2 8 3 3.5h3L8 6.2 10 3.5h3L9.8 8 13 12.5h-3L8 9.8 6 12.5H3z" />',
    timeline: '<circle cx="8" cy="8" r="5.2" /><path d="M8 5.2V8l2 1.4" />',
    business: '<rect x="3" y="3" width="4" height="4" rx="0.8" /><rect x="9" y="3" width="4" height="4" rx="0.8" /><rect x="3" y="9" width="4" height="4" rx="0.8" /><rect x="9" y="9" width="4" height="4" rx="0.8" />',
    goals: '<circle cx="8" cy="8" r="5.2" /><circle cx="8" cy="8" r="2" />',
    policy: '<path d="M4 3.5h8v9.2L8 11.2l-4 1.5V3.5z" />',
    settings: '<circle cx="8" cy="8" r="2.1" /><path d="M8 2.6v1.3M8 12.1v1.3M2.6 8h1.3M12.1 8h1.3" />',
    collapse: '<path d="M10 3 5 8l5 5" />',
    wave: '<path d="M2 12h4l3-7 4 14 3-7h6" />',
  };

  const svg = (name) => `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name]}</svg>`;

  const item = ({ href, key, label, disabled }) => {
    const current = key === active;
    if (disabled) {
      return `<span class="nav-item" aria-disabled="true">${svg(key)}${label}</span>`;
    }
    return `<a class="nav-item" href="${href}"${current ? ' aria-current="page"' : ""}>${svg(key)}${label}</a>`;
  };

  const mountSidebar = () => {
    const host = document.querySelector("[data-os-sidebar]");
    if (!host) return;
    host.innerHTML = `
      <div class="brand">
        <a class="brand-link" href="shell.html">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24">${ICONS.wave}</svg>
          </span>
          <span class="brand-name">EvoPulse</span>
        </a>
        <button class="collapse icon-btn" type="button" data-collapse aria-expanded="true" aria-label="Collapse sidebar">
          ${svg("collapse")}
        </button>
      </div>

      <div class="sidebar-launch">
        <button class="control control-primary" type="button" data-open-command>
          ${svg("plus")}
          New command
        </button>
        <button class="control" type="button" data-open-command>
          ${svg("search")}
          Ask your business
          <kbd>⌘K</kbd>
        </button>
      </div>

      <nav class="nav-block" aria-label="Primary">
        <div class="nav-label">Primary</div>
        ${item({ href: "shell.html", key: "pulse", label: "Pulse" })}
        ${item({ href: "command-overlay.html", key: "command", label: "Command" })}
        ${item({ key: "timeline", label: "Timeline", disabled: true })}
      </nav>

      <nav class="nav-block" aria-label="Workspace">
        <div class="nav-label">Workspace</div>
        ${item({ key: "business", label: "Business", disabled: true })}
        ${item({ key: "goals", label: "Goals", disabled: true })}
      </nav>

      <div class="sidebar-foot">
        <span class="nav-item" aria-disabled="true">${svg("policy")}Policies / Control</span>
        <span class="nav-item" aria-disabled="true">${svg("settings")}Settings</span>
        <div class="live" aria-label="Live event clock"><i></i> LIVE</div>
        <div class="clock">SUN 27 SEP · 14:32 CET</div>
        <div class="user-row">
          <span class="avatar" aria-hidden="true">MO</span>
          <span>Mohamed<small>Operator</small></span>
        </div>
      </div>
    `;
  };

  const applyQuietState = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("state") !== "quiet") return;
    const title = document.querySelector(".page-header h1");
    const lede = document.querySelector(".lede");
    if (title) title.textContent = "Your business is running.";
    if (lede) lede.textContent = "Nothing needs you. Ask when you want to look.";
    document.querySelectorAll(".ghost-stack").forEach((stack) => {
      stack.innerHTML = `
        <div class="ghost-row">
          <span>Quiet operational row (not designed)</span>
          <span class="status status--auto"><i></i> Handled</span>
        </div>
        <div class="ghost-row">
          <span>Quiet operational row (not designed)</span>
          <span class="status status--monitor"><i></i> Monitoring</span>
        </div>
      `;
    });
  };

  const openCommand = () => {
    if (document.body.classList.contains("artifact-command")) {
      window.location.href = "command-overlay.html";
      return;
    }
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

  mountSidebar();
  applyQuietState();

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-command]")) {
      event.preventDefault();
      openCommand();
    }
    if (event.target.closest("[data-close-command]")) {
      closeCommand();
    }
    if (event.target.closest("[data-collapse]") || event.target.closest("[data-reopen-sidebar]")) {
      event.preventDefault();
      toggleSidebar();
    }
  });

  layer?.addEventListener("click", (event) => {
    if (event.target === layer) closeCommand();
  });

  document.addEventListener("keydown", (event) => {
    const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (metaK) {
      event.preventDefault();
      if (document.body.classList.contains("artifact-command")) return;
      if (layer?.classList.contains("is-open")) {
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
      if (document.querySelector(".os--inspector") && window.matchMedia("(max-width: 1024px)").matches) {
        window.location.href = "shell.html";
      }
    }
  });

  if (document.body.classList.contains("artifact-command")) {
    field?.focus();
    field?.setSelectionRange(field.value.length, field.value.length);
  }
})();
