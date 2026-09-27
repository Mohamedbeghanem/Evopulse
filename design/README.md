# EvoPulse Control OS — design

Phase 0 only. Nothing here is production UI. Do not copy these files into `app/`.

Visual review starts with the **shell**, not Pulse.

## Open this first

Serve from the repo root so Aurora tokens resolve:

```bash
python3 -m http.server 8767 --directory .
```

Then:

- [Shell](http://127.0.0.1:8767/design/screens/00-shell/shell.html) — labeled sidebar, briefing, composer
- [Quiet shell](http://127.0.0.1:8767/design/screens/00-shell/shell.html?state=quiet) — no orange clause
- [Command overlay](http://127.0.0.1:8767/design/screens/00-shell/command-overlay.html) — ⌘K / Ask your business
- [Inspector](http://127.0.0.1:8767/design/screens/00-shell/inspector.html) — Atlas Supply context

## Foundation documents

| File | Answers |
| --- | --- |
| [LEGACY_HTML_AUDIT.md](./LEGACY_HTML_AUDIT.md) | KEEP / EVOLVE / REMOVE / MOVE for the four HTML prototypes. Owning engines: Events / Graph / Detect / Impact / Control. |
| [CONTROL_OS_IA.md](./CONTROL_OS_IA.md) | Pulse · Command · Timeline · Business · Goals. Old TWIN / CAUSE / TIME / ACT live underneath. |
| [CONTROL_OS_LAYOUT.md](./CONTROL_OS_LAYOUT.md) | 1440 frame. 240px labeled sidebar. No 64px rail. No 380px header ask. |
| [AURORA_BRANDBOOK.md](./AURORA_BRANDBOOK.md) | Dark control room. Orange = attention only. Plex Sans + Mono. |
| [AURORA_TOKENS.css](./AURORA_TOKENS.css) | Canvas `#07090C`, nav `#090C10`, attention `#FF5A1F`. |
| [MOBBIN_RESEARCH.md](./MOBBIN_RESEARCH.md) | ChatGPT / workspace take-and-leave. |

## Screen library

Contracts only for 01–19. Visuals only in [`screens/00-shell/`](./screens/00-shell/). Index: [`screens/README.md`](./screens/README.md).

## Legacy prototypes

Untouched copies: [`references/legacy-html/`](./references/legacy-html/). Audit them; do not restyle them.

## Stop

Do not design Pulse cards or remaining screens until this shell is accepted.
