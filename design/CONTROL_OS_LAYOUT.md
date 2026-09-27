# Control OS layout

Dark-first chrome. Primary frame **1440 × 900**. Tokens: [`AURORA_TOKENS.css`](./AURORA_TOKENS.css).

This is not the 64px legacy icon rail and not a light dashboard.

---

## 1440 desktop frame

| Region | Origin | Size | Notes |
| --- | --- | --- | --- |
| Frame | 0, 0 | 1440 × 900 | Artboard. Live app is `100vw × 100vh`. |
| Sidebar | 0, 0 | **240 × 900** | Labeled. Persistent. Not a 64px icon rail. |
| Workspace | 240, 0 | **1200 × 900** | Canvas `#07090C`. |
| Header | 240, 0 | 1200 × **56** | Title + briefing + contextual actions. No global 380px ask. |
| Inspector (closed) | — | 0 | Not reserved. |
| Inspector (open) | 1080, 0 | **360 × 900** | Workspace → 840px. |

Sidebar lock: **240px** (220–248). Inspector lock: **360px** (320–380).

---

## Sidebar

Quiet ChatGPT-like density. Legacy **visual** DNA (nav `#090C10`, hairline `#1C232C`, 34px rows). Legacy **IA** (TWIN/CAUSE/TIME/ACT) is gone.

```
240px
  Wordmark + pulse mark     56px
  New command               34px
  Search / ⌘K               34px

  PRIMARY
    Pulse                   34px
    Command                 34px
    Timeline                34px

  WORKSPACE
    Business                34px
    Goals                   34px

  (flex)

  Policies / Control
  Settings
  LIVE · clock (freshness)
  User
```

| Rule | Value |
| --- | --- |
| Width | 240px |
| Gutter | 16px |
| Item | 34px high, 6px radius |
| Active | `--aurora-surface-active`, no capsule, no orange fill |
| Active mark | 2px orange leading edge **or** ink weight — not a glowing tile |
| Section label | 11px mono, 0.12em, `--aurora-muted` |

Do not add Causal, Simulate, Autopilot, Approvals, Evidence, Graph, Learning.

---

## Workspace modes

| Mode | Width | Used for |
| --- | --- | --- |
| **FOCUSED** | 760–900, lock **840** centered | Command, Evidence, Exception reasoning |
| **OPERATIONAL** | 1080–1200, lock **1140** | Pulse, Goals, Timeline, Twin |
| **CANVAS** | full remaining, 24px gutter | Graph, Causal, Simulation |

Inspector open at 1440: 840px pane. FOCUSED fits; OPERATIONAL compresses.

---

## Inspector

360px. Recessed `#0A0D11` rows. Mono keys. Close: Escape / ×.

Quick context. Full page for deep investigation.

At **1024**: overlay, 320px, dim workspace.

---

## Header

56px. No giant masthead. No small global search.

```
Pulse                                          LIVE    [Today]
2 decisions need you.
```

or quiet:

```
Pulse                                          [Today]
Your business is running.
```

Title 22–26px **Sans**. Orange clause only when something needs you. Actions 32px.

---

## Universal composer

Elevated from the legacy 380×34 header field.

| Rule | Value |
| --- | --- |
| Placeholder | Ask your business… |
| Max width | 840px |
| Min height | 56px |
| Radius | 10px |
| Fill | `--aurora-surface` |
| Border | `#232B35` |
| Submit | orange 32px **only** as the act control |

Dock 24px above the workspace bottom. Overlay (`⌘K`) uses the same chrome, larger, centered.

---

## Spacing, radii, borders

| Token | Value |
| --- | --- |
| Workspace gutter | 28px (legacy 22–28) |
| Sidebar gutter | 16px |
| Inspector gutter | 20px |
| Rhythm | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 |
| Chip | 4px |
| Control | 6px |
| Panel | 10px |
| Overlay | 12px |
| Border | 1px hairline |
| Default elevation | none (dark UI uses hairlines, not drop shadows) |
| Overlay | deep shadow `0 24px 64px rgba(0,0,0,.55)` |

---

## Responsive

Primary **1440**. Validate **1280** and **1024**. No mobile pass.

### 1280

Sidebar 220. Inspector 320. OPERATIONAL shrinks. FOCUSED still centered.

### 1024

Sidebar collapsible (not an icon rail). Collapse control in the wordmark row. Reopen 40px top-left. Inspector overlays.

---

## Focus and motion

Visible `--focus-ring` (orange). Escape closes overlays. `prefers-reduced-motion` kills pulse.

---

## What this layout refuses

- 64px engine rail
- Persistent inspector
- Full-bleed FOCUSED content
- Light / warm-paper chrome
- Top-nav module pills (current production)
- Mobile layouts
