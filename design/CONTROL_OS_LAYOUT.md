# Control OS layout

Phase 0. Exact chrome for the persistent EvoPulse shell.

Primary frame: **1440 × 900**. Tokens live in `AURORA_TOKENS.css`.

This is not a dashboard grid. It is an operating environment: sidebar + workspace, with a contextual inspector.

---

## 1440 desktop frame

| Region | Origin (x, y) | Size | Notes |
| --- | --- | --- | --- |
| Frame | 0, 0 | 1440 × 900 | Design artboard. Live app is `100vw × 100vh`. |
| Sidebar | 0, 0 | **240 × 900** | Persistent. Never a tiny icon rail in this phase. |
| Workspace | 240, 0 | **1200 × 900** | Canvas + header + content + composer. |
| Header | 240, 0 | 1200 × **56** | Restrained. Title + one situational line + contextual actions. |
| Workspace body | 240, 56 | 1200 × remaining | Scrolls independently of the sidebar. |
| Inspector (closed) | — | 0 | Not mounted. Does not reserve width. |
| Inspector (open) | 1080, 0 | **360 × 900** | Workspace compresses to 840px. |

Sidebar width target: **220–248px**. Locked value: **240px**.

Inspector width target: **320–380px**. Locked value: **360px**.

---

## Sidebar

```
┌ 240px ──────────────────────────────────┐
│ 16px gutter                             │
│                                         │
│  WORDMARK          40px row             │
│  New command       34px control         │
│  Search / ⌘K       34px control         │
│                                         │
│  PRIMARY           8px section gap      │
│    Pulse           34px item            │
│    Command         34px item            │
│    Timeline        34px item            │
│                                         │
│  WORKSPACE                              │
│    Business        34px item            │
│    Goals           34px item            │
│                                         │
│  (flex spacer)                          │
│                                         │
│  Policies / Control                     │
│  Settings                               │
│  User                                   │
└─────────────────────────────────────────┘
```

| Rule | Value |
| --- | --- |
| Width | 240px |
| Inner gutter | 16px left / right |
| Wordmark row | 56px tall (aligns with workspace header) |
| Control / nav item | **34px** high, **8px** radius |
| Item pad | 8px 10px |
| Icon | 16px, 8px gap to label |
| Active | `--aurora-surface-raised` fill, no border, no capsule |
| Hover | 4% ink wash |
| Section label | 11px, uppercase, 0.14em, `--aurora-subtle` |
| Bottom stack | pinned |

Do not add: warnings, exceptions, simulation, autopilot, approvals, evidence, graph, learning.

---

## Workspace origin

Workspace always begins at **x = sidebar width** (240px at 1440).

Background: `--aurora-canvas` with a quiet warm wash (see tokens). Content does **not** stretch to the screen edges unless the screen is in CANVAS mode.

Three modes:

| Mode | Content width | Used for |
| --- | --- | --- |
| **FOCUSED** | **760–900px**, locked **840px**, centered | Command, Evidence, Exception reasoning |
| **OPERATIONAL** | **1080–1200px**, locked **1140px**, left-aligned with 32px gutter (or centered if the pane is wider) | Pulse, Goals, Timeline |
| **CANVAS** | full available width, 24px gutter | Graph, Causal Explorer, Simulation |

When the inspector opens, available workspace width = `frame − sidebar − inspector`.

- 1440, inspector open: 1440 − 240 − 360 = **840px** → FOCUSED fits exactly; OPERATIONAL compresses; CANVAS uses the 840px pane.

---

## Inspector

| Rule | Value |
| --- | --- |
| Width | 360px (min 320 / max 380) |
| Presence | Contextual. Closed by default. |
| Elevation | `--elevate-inspector` |
| Pad | 20px |
| Header | 56px (same as page header) |
| Close | Escape, ×, or clicking the dim-free workspace (desktop) |

Use inspector for quick context. Use a full page for deep investigation.

At **1024**, inspector becomes a right overlay over the workspace (does not permanently steal 360px).

---

## Header

Height: **56px**. No giant dashboard headers.

```
Pulse                                          [Today ▾]  [•••]
Your business is running.
```

or

```
Atlas Supply delay                             [Simulate]
AT RISK — NOT MISSED
```

| Rule | Value |
| --- | --- |
| Title | 22px, `--font-sans`, 600, `--aurora-ink` |
| Situation line | 13–14px, `--aurora-muted` |
| Status phrase | 11px mono, uppercase, with a 6px text label + 6px dot |
| Actions | right-aligned, 32px controls, 8px radius |
| Divider | optional 1px hairline under the header, never a heavy bar |

---

## Universal composer

Signature input. Navigation, not decoration.

| Rule | Value |
| --- | --- |
| Min height | 56px |
| Max width | 840px (FOCUSED). In OPERATIONAL, same 840px centered under the column. |
| Radius | 12px |
| Border | 1px `--aurora-hairline` |
| Fill | `--aurora-surface-raised` |
| Placeholder | “Ask EvoPulse anything about your business” |
| Left affordance | + (attachments later) |
| Mode hint | “Search business” — inferred, not four giant tabs |
| Submit | → 32px |
| Modes | `/ask` `/search` `/simulate` `/act` — subtle, inferred |

Dock: 24px above the workspace bottom edge on Pulse / Command. Overlay command (`⌘K`) uses the same chrome, larger, centered.

---

## Content widths, gutters, spacing

| Token | Value |
| --- | --- |
| Sidebar gutter | 16px |
| Workspace gutter | 32px (CANVAS: 24px) |
| Inspector gutter | 20px |
| Vertical rhythm | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 |
| Section gap | 24px |
| Stack gap | 8–12px |

---

## Radii, borders, elevation

| Token | Value |
| --- | --- |
| Chip / status | 4px |
| Nav item / button | 8px |
| Composer / card / inspector | 12px |
| Command overlay | 16px |
| Border | 1px hairline only |
| Default elevation | none |
| Overlay | `0 16px 40px rgba(27, 25, 20, 0.16)` |
| Inspector | hairline + soft 8px shadow |

No gradients on chrome. No giant capsules. No strong borders.

---

## Responsive rules

Primary: **1440**. Validate **1280** and **1024**. Do not optimize mobile in this phase.

### 1440

Full spec. Sidebar 240. Inspector 360 when open. OPERATIONAL content 1140.

### 1280

| Rule | Value |
| --- | --- |
| Sidebar | 220px |
| Inspector | 320px |
| Workspace | 1060 (closed) / 740 (open) |
| OPERATIONAL | shrinks to available width, 24px gutter. Do not clip. |
| FOCUSED | 740–840, still centered |
| CANVAS | full remaining pane |

### 1024

| Rule | Value |
| --- | --- |
| Sidebar | collapsible. Default expanded 220px. Collapse control in the wordmark row. |
| Collapsed | 0 width (not an icon rail). A 40px edge affordance reopens it. |
| Inspector | **overlay** (fixed right, 320px) with `--aurora-overlay` on the workspace |
| OPERATIONAL / FOCUSED | single column, 20px gutter |
| Composer | full remaining width minus gutters |

Touch targets stay ≥ 32px. Keyboard still owns Command.

---

## Focus and motion

- Visible focus: `--focus-ring` on every interactive control.
- `prefers-reduced-motion`: no translate/opacity animation.
- Overlay enter: 120ms opacity only when motion is allowed.

---

## What this layout refuses

- A second sidebar of engine names
- Persistent inspector
- Full-bleed cards on FOCUSED screens
- Top-nav module pills (the current production chrome)
- Mobile layouts
