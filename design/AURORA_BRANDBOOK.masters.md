# Aurora brandbook

Aurora is the visual system for EvoPulse — an AI-native **business control system**.

It is not a skin for a CRM, a dashboard kit, or a chatbot.

Tagline used in chrome: **Nothing falls through.**

---

## Character

| Aurora is | Aurora is not |
| --- | --- |
| Calm | Excited, gamified, “AI wow” |
| Precise | Decorative |
| Intelligent | Chatty |
| Premium | Template SaaS |
| Operational | Analytical wallpaper |
| Trustworthy | Autonomous-looking |

A quiet room with one lit instrument. Normal business stays quiet. Color is status, not branding.

---

## Forbidden aesthetics

- Generic purple AI SaaS
- Neon cyberpunk / HUD grids
- Glassmorphism, blur stacks, glow orbs
- Giant 24px+ rounded cards
- Drop-shadow elevation as hierarchy
- Pill-everything (nav, chips, every button)
- KPI tile grids as the home
- ChatGPT bubble columns as the product
- Stock photography, avatars, illustrations
- DeepSeek / vendor marks

---

## Color tokens

One restrained accent: **warm bronze**. Status hues are semantic, never decorative fills.

| Token | HEX | RGB | CSS | Meaning |
| --- | --- | --- | --- | --- |
| `CANVAS` | `#0A0C10` | 10, 12, 16 | `--aurora-canvas` | App room. Almost black, slightly warm. |
| `SURFACE` | `#12151C` | 18, 21, 28 | `--aurora-surface` | Sidebar, header, selected row, panels. |
| `SURFACE_SECONDARY` | `#1A1E27` | 26, 30, 39 | `--aurora-surface-2` | Nested wells, disclosure, hover. |
| `INK` | `#EDE6D6` | 237, 230, 214 | `--aurora-ink` | Primary text. Paper, not white. |
| `MUTED` | `#8A8374` | 138, 131, 116 | `--aurora-muted` | Secondary text, timestamps, nav idle. |
| `HAIRLINE` | `#2A2E38` | 42, 46, 56 | `--aurora-hairline` | 1px rules. Structure without boxes. |
| `PRIMARY` | `#C4A574` | 196, 165, 116 | `--aurora-primary` | Primary controls, selected nav, wordmark. |
| `AURORA_ACCENT` | `#D4B483` | 212, 180, 131 | `--aurora-accent` | Selection tick, focus-adjacent highlight. |
| `ATTENTION` | `#E8A317` | 232, 163, 23 | `--aurora-attention` | Needs you. Warning layer. Amber — not loss. |
| `CRITICAL` | `#C45C4A` | 196, 92, 74 | `--aurora-critical` | Blocked, failed, missed. Terracotta. |
| `SUCCESS` | `#6B9B7A` | 107, 155, 122 | `--aurora-success` | Handled, verified, safe auto. Sage. |
| `SIMULATION` | `#6B8CAE` | 107, 140, 174 | `--aurora-sim` | Not live business state. Cool steel. |
| `FOCUS` | `#E8D5A3` | 232, 213, 163 | `--aurora-focus` | Keyboard focus ring only. |

Derived:

```css
:root {
  --aurora-canvas: #0A0C10;
  --aurora-surface: #12151C;
  --aurora-surface-2: #1A1E27;
  --aurora-ink: #EDE6D6;
  --aurora-muted: #8A8374;
  --aurora-hairline: #2A2E38;
  --aurora-primary: #C4A574;
  --aurora-accent: #D4B483;
  --aurora-attention: #E8A317;
  --aurora-critical: #C45C4A;
  --aurora-success: #6B9B7A;
  --aurora-sim: #6B8CAE;
  --aurora-focus: #E8D5A3;
  --aurora-ink-88: rgba(237, 230, 214, 0.88);
  --aurora-ink-56: rgba(237, 230, 214, 0.56);
  --aurora-attention-dim: rgba(232, 163, 23, 0.14);
  --aurora-success-dim: rgba(107, 155, 122, 0.12);
  --aurora-critical-dim: rgba(196, 92, 74, 0.12);
  --aurora-sim-dim: rgba(107, 140, 174, 0.14);
  --aurora-primary-dim: rgba(196, 165, 116, 0.12);
}
```

Usage rules:

- Canvas is never a gradient.
- Surfaces are flat. Hover = `SURFACE_SECONDARY`, not a shadow.
- `ATTENTION` marks **needs you / at risk**, never “lost revenue.”
- `CRITICAL` is rare. Policy block uses it as a rule stripe, not an error toast.
- `SIMULATION` must appear whenever numbers are hypothetical. Live numbers never wear this color.
- Do not tint whole cards. A 2px leading edge or a label is enough.

---

## Typography

Family: **IBM Plex Sans** (UI) and **IBM Plex Mono** (money, time, IDs, traces).

These are already in the product. Do not add a display serif, variable-font CDN, or brand script just for Aurora.

Fallback: `ui-sans-serif, system-ui, sans-serif` / `ui-monospace, "SFMono-Regular", Menlo, monospace`.

| Role | Size / line / weight / tracking | Use |
| --- | --- | --- |
| Display | 32 / 40 / 400 / −0.02em | Pulse sentence. “Your business is running.” |
| Page title | 22 / 28 / 500 / −0.01em | “Ask EvoPulse”, “Why is this at risk?” |
| Section title | 11 / 16 / 600 / 0.12em | `NEEDS YOU`, `MONITORING`, `EVIDENCE`. Caps. |
| Card title | 16 / 22 / 500 / 0 | Situation name. |
| Body | 14 / 22 / 400 / 0 | Explanations, evidence statements. |
| Small | 12 / 18 / 400 / 0 | Meta, clock, secondary counts. |
| Label | 10 / 14 / 600 / 0.14em | Status badges, field labels. Caps. |
| Metric | 28 / 32 / 500 / −0.03em · Mono | `850,000 DZD`, `−23h` |
| Metric sm | 16 / 20 / 500 / −0.02em · Mono | Inline money / hours |
| Mono / data | 12 / 18 / 400 / 0 · Mono | Event IDs, traces, clock ISO |

Financial and temporal values are **always mono**. Format:

```
850,000 DZD
540,000 DZD
320,000 DZD
160,000 DZD
−23h
18h
−41h
```

Use a true minus `−` (U+2212) on negative hours. Never “850K lost.”

---

## Spacing scale

`4  8  12  16  20  24  32  40  48  64`

No 6, 10, 14, or 18 except inside 6–8px control radii.

| Application | Token |
| --- | --- |
| Sidebar width | 220 |
| Header height | 56 |
| Page gutter 1440 | 32 |
| Page gutter 1280 | 24 |
| Page gutter 1024 | 16 |
| Content max width | 1120 |
| Card / row padding | 20 |
| Section gap | 32 |
| Stack inside a situation | 12 |
| Table / list row | 44 min |
| Drawer width | 400 |
| Command input height | 48 |
| Primary button height | 36 |
| Icon button | 32 |

---

## Geometry

| Element | Radius |
| --- | --- |
| Small controls (button, input, badge) | 6–8px |
| Situation rows / cards | 10–12px |
| Large containers (drawer, modal, shell panes) | 16px max |

Hairlines are 1px. Selected situation: 2px `PRIMARY` leading edge, not a glow.

Avoid pills. Nav items are 8px-radius rows. Badges are 6px, not 999px.

---

## Elevation

There is almost none.

- Default: flat on canvas
- Overlay / drawer: `SURFACE` + 1px `HAIRLINE`
- Modal: same + 24px dim (`rgba(10,12,16,0.72)`)

No stacked shadows. Depth = overlay + edge, not blur.

---

## Status language

Status is a **word + color + (optional) time**. Color alone is never enough.

| State | Label | Color | Meaning |
| --- | --- | --- | --- |
| Needs you | `NEEDS YOU` | Attention | Human must look. |
| Needs approval | `NEEDS APPROVAL` | Attention | Human must decide. AI cannot self-approve. |
| At risk | `AT RISK — NOT MISSED` | Attention | Warning. Deadline still ahead. |
| Monitoring | `MONITORING` | Muted / ink | Future risk, not failure. |
| Auto handled | `HANDLED AUTOMATICALLY` | Success | Safe action executed + verified. |
| Handled | `HANDLED` | Success | Verified closed. |
| Blocked | `BLOCKED BY POLICY` | Critical | Governance. Not a crash. |
| Simulation | `SIMULATION · NOT LIVE` | Simulation | Hypothetical. |
| Waiting | `WAITING FOR YOU` | Attention | Agent paused on approval. |

Laws encoded visually:

1. Associated revenue ≠ lost revenue — money sits under “associated” / “cash timing.”
2. Warning ≠ exception — warning is a layer on a situation, not a second card.
3. Simulation ≠ reality — steel band + `NOT LIVE BUSINESS STATE`.
4. Execution ≠ resolution — executed steps stay open until verification.
5. One situation, one attention object.

---

## Iconography

No icon library in this pass. Status is type. Causal steps use a 1px vertical rule and a 6px square node.

If icons are added later: 16px stroke, 1.5px, no filled brand marks.

---

## Motion

- 160ms ease for hover / select
- 280ms ease for disclosure / drawer
- Agent steps: sequential reveal, 420ms apart, no bounce
- No skeleton shimmer as personality
- Reduced-motion: snap, no staged reveal

---

## Voice

Short. Operational. No generated prose as truth.

Good: `Atlas Supply revised Shipment SH-204. Monday → Wednesday.`
Bad: `It looks like there might be a potential delay that could impact…`

Money is exact. Time is exact. Policy is a rule, not an apology.

---

## Canonical components (specification only)

Not implemented in production React in this pass.

### AppShell
220 sidebar + 56 header + canvas. Full viewport. No marketing footer.

### Sidebar
Wordmark `EVOPULSE` (label, 11/600/0.16em, primary). Five items only: Pulse, Command, Timeline, Business, Goals. Active = primary text + 2px leading edge. Bottom: `Nothing falls through.`

### TopBar
Clock (`Sun 27 Sep 2026 · 08:18 Africa/Tunis`) left. Quiet utilities right. No search chrome on Pulse.

### PageHeader
Display or page title + one-line lede. No breadcrumb theater.

### CommandInput
48px, 8px radius, hairline, placeholder `Ask anything about your business…`. No send orb.

### AttentionItem
Full-width row. Leading 2px state edge when selected. Title, one-line cause, impact strip, actions. Not a KPI tile.

### StatusBadge
Label role, 6px radius, dim fill + ink/status text. Always includes words.

### Metric
Mono. Optional caption under (`associated revenue`, `expected cash timing`).

### EvidenceRow
Observed / source / calculated / assumption. Four fields, not a paragraph.

### EventRow
Time · type · statement. 44px.

### ImpactSummary
`3 orders · 3 customers · 850,000 DZD associated · 540,000 DZD cash timing`

### DependencyPath
Vertical. Node square + label. Selected node inks; others mute.

### WarningState
`AT RISK — NOT MISSED` + buffer trio.

### ExceptionState
What diverged. Same situation object — not a second card.

### AutopilotState
Classification word only: NEEDS YOU / AUTO / BLOCKED. Not a destination.

### ApprovalPanel
What / why / impact / policy / evidence. Approve · Edit · Reject. Caption: `EvoPulse cannot approve itself.`

### PolicyRule
Requested vs allowed. Alternative. `ACTION BLOCKED BY POLICY` — governance, not error.

### SimulationDelta
Three columns: CURRENT · SIMULATED · DELTA. Steel frame. Authoritative +3d delta: Invoice C **160,000 DZD** timing.

### GoalCard / PlanStep / VerificationState / OutcomeRecord
Level 3 objects. Plan steps show policy bucket: SAFE / APPROVAL / BLOCKED.

### AgentRun / AgentStep / ToolResult / HumanApproval
Business verbs: Inspecting, Tracing, Assessing impact… Never `tool_call` / JSON in primary UI.

### Button
Height 36. Primary = bronze fill, canvas text. Secondary = hairline, ink. Ghost = muted. Radius 8. Danger = critical text, not filled red.

### Input / Tabs / Drawer / Modal / Tooltip
Hairline. Tabs are underlined, not pills. Drawer 400 from right.

### EmptyState
`Your business is running.` — not an illustration.

### LoadingState
One line: `Inspecting business…` with a 2px primary bar.

### ErrorState
What failed + retry. Never styled like a policy block.

---

## Simulation visual language

Even though Simulation is not a master screen in this pass:

```
SIMULATION
NOT LIVE BUSINESS STATE

CURRENT          SIMULATED         DELTA
Invoice C due    Invoice C due     Timing moved
week of 28 Sep   next period       160,000 DZD
```

Do **not** move 540,000 DZD as the +3-day delta. That is associated cash headline, not the simulated timing shift.

---

## Three experience levels

| Level | Question | Master |
| --- | --- | --- |
| Control | What needs me? | Pulse |
| Understand | Why? | Risk / Why |
| Act | What should happen next? | Command (plus contextual simulate / approve) |

Aurora must make the category readable in 5–10 seconds: a quiet board of exceptions, not a dashboard of charts.
