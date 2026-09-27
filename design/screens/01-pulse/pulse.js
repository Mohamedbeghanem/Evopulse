(() => {
  const os = document.querySelector(".os");
  const inspector = document.querySelector(".inspector");
  const panels = [...document.querySelectorAll("[data-inspector-panel]")];
  const layers = [...document.querySelectorAll("[data-layer]")];
  const commandLayer = document.querySelector("#command");
  const commandField = document.querySelector("#command-query");
  const composer = document.querySelector("#composer-query");
  const commandHits = document.querySelector("#command-hits");

  const closeLayers = () => {
    layers.forEach((layer) => {
      layer.classList.remove("is-open");
      layer.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "";
  };

  const openLayer = (name, focusSelector) => {
    closeLayers();
    const layer = document.querySelector(`[data-layer="${name}"]`);
    if (!layer) return;
    layer.classList.add("is-open");
    layer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    const focus = layer.querySelector(focusSelector || "h2, button, input");
    window.setTimeout(() => focus?.focus?.(), 0);
  };

  const showInspector = (panelId) => {
    if (!os || !inspector) return;
    os.classList.add("os--inspector");
    inspector.hidden = false;
    inspector.setAttribute("aria-hidden", "false");
    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute("data-inspector-panel") !== panelId;
    });
    inspector.querySelector("h2")?.scrollIntoView({ block: "nearest" });
  };

  const hideInspector = () => {
    os?.classList.remove("os--inspector");
    if (inspector) {
      inspector.hidden = true;
      inspector.setAttribute("aria-hidden", "true");
    }
  };

  const openCommand = (preset) => {
    if (!commandLayer) return;
    closeLayers();
    commandLayer.classList.add("is-open");
    commandLayer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (preset && commandField) commandField.value = preset;
    renderHits(commandField?.value || "");
    window.setTimeout(() => commandField?.focus(), 0);
  };

  const closeCommand = () => {
    if (!commandLayer) return;
    commandLayer.classList.remove("is-open");
    commandLayer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const hitsFor = (query) => {
    const q = query.trim().toLowerCase();
    const rows = [
      {
        group: "Situations",
        title: "Atlas Supply",
        detail: "NEEDS YOU · 850,000 DZD associated · SH-204",
        action: "review-atlas",
      },
      {
        group: "Situations",
        title: "320,000 DZD proposal",
        detail: "NEEDS APPROVAL · customer-facing send",
        action: "approve-320",
      },
      {
        group: "Commands",
        title: "What needs me?",
        detail: "Return to Pulse attention",
        action: "pulse",
      },
      {
        group: "Commands",
        title: "What changed today?",
        detail: "Supplier delay · missed Thursday send",
        action: "review-atlas",
      },
      {
        group: "Commands",
        title: "What am I about to miss?",
        detail: "Oran Fresh Tuesday delivery — at risk, not missed",
        action: "review-atlas",
      },
      {
        group: "Commands",
        title: "Simulate another day of delay",
        detail: "Open Simulation from Atlas",
        action: "simulate-atlas",
      },
    ];
    if (!q) return rows;
    return rows.filter((row) => `${row.title} ${row.detail}`.toLowerCase().includes(q));
  };

  const renderHits = (query) => {
    if (!commandHits) return;
    const rows = hitsFor(query);
    const groups = [...new Set(rows.map((row) => row.group))];
    commandHits.innerHTML = groups
      .map((group) => {
        const items = rows.filter((row) => row.group === group);
        return `<div class="command-group"><h3>${group}</h3>${items
          .map(
            (row) =>
              `<button class="result" type="button" data-command-hit="${row.action}">
                <span class="result-kind" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.2"/><path d="M8 5.2V8l2 1.4"/></svg></span>
                <span><strong>${row.title}</strong><small>${row.detail}</small></span>
              </button>`,
          )
          .join("")}</div>`;
      })
      .join("") || `<p class="placeholder-note" style="padding:12px 10px 4px">No matching business objects or commands.</p>`;
  };

  const runAction = (name) => {
    closeCommand();
    if (name === "review-atlas") openLayer("situation-atlas");
    if (name === "simulate-atlas") openLayer("simulate-atlas");
    if (name === "approve-320") openLayer("approve-320");
    if (name === "evidence-atlas") {
      showInspector("atlas-evidence");
      openLayer("evidence-atlas");
    }
    if (name === "impact-atlas") showInspector("atlas-impact");
    if (name === "causal-atlas") showInspector("atlas-impact");
    if (name === "pulse") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  document.addEventListener("click", (event) => {
    const open = event.target.closest("[data-open]");
    if (open) {
      event.preventDefault();
      runAction(open.getAttribute("data-open"));
      return;
    }

    const hit = event.target.closest("[data-command-hit]");
    if (hit) {
      runAction(hit.getAttribute("data-command-hit"));
      return;
    }

    if (event.target.closest("[data-close-layer]")) {
      closeLayers();
      return;
    }

    if (event.target.closest("[data-close-inspector]")) {
      hideInspector();
      return;
    }

    const layer = event.target.closest("[data-layer]");
    if (layer && event.target === layer) closeLayers();
  });

  document.querySelectorAll("[data-open-command]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      openCommand(el.getAttribute("data-command") || "");
    });
  });

  document.querySelectorAll("[data-close-command]").forEach((el) => {
    el.addEventListener("click", closeCommand);
  });

  commandLayer?.addEventListener("click", (event) => {
    if (event.target === commandLayer) closeCommand();
  });

  commandField?.addEventListener("input", () => renderHits(commandField.value));

  document.querySelector("#composer-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    openCommand(composer?.value || "");
  });

  document.addEventListener("keydown", (event) => {
    const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    if (metaK) {
      event.preventDefault();
      if (commandLayer?.classList.contains("is-open")) {
        closeCommand();
        composer?.focus();
      } else {
        openCommand(composer?.value || "");
      }
    }
    if (event.key === "Escape") {
      if (commandLayer?.classList.contains("is-open")) {
        closeCommand();
        return;
      }
      if (document.querySelector(".layer.is-open")) {
        closeLayers();
        return;
      }
      if (os?.classList.contains("os--inspector")) hideInspector();
    }
  });

  hideInspector();
})();
