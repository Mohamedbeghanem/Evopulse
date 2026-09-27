# Aurora brandbook — Control OS

Aurora is the visual system for EvoPulse as **one operating environment**.

It evolves the dark operational DNA in [`references/legacy-html/`](./references/legacy-html/) and the workspace restraint studied in [`MOBBIN_RESEARCH.md`](./MOBBIN_RESEARCH.md). Tokens live in [`AURORA_TOKENS.css`](./AURORA_TOKENS.css). Layout numbers live in [`CONTROL_OS_LAYOUT.md`](./CONTROL_OS_LAYOUT.md).

This is not a light SaaS theme. It is not a ChatGPT skin. It is not a cyberpunk terminal.

---

## Character

A calm live control room for a business.

| When | Feeling |
| --- | --- |
| Everything is fine | Quiet near-black. Secondary ink. No orange. |
| Something needs you | Orange is unmistakable — and rare. |
| The user wants to ask | Conversational entry. One composer. |
| EvoPulse needs to act | Policy tags. Approve / Decline. Ice for AUTO. |

EvoPulse **observes, understands, monitors, simulates, plans, acts, verifies.**

The operator should think: *EvoPulse understands my business* — not *I have four tools*.

---

## What Aurora inherits (KEEP)

From the four legacy HTML prototypes (audit: [`LEGACY_HTML_AUDIT.md`](./LEGACY_HTML_AUDIT.md)):

- Near-black canvas `#07090C`, nav `#090C10`, raised `#141A22`
- High information contrast (`#E8ECF1` on `#07090C`)
- Orange `#FF5A1F` / `#FF7A45` for **attention and active control only**
- Ice `#7FB2E0` for machine / AUTO / handled (not celebration)
- Watch `#F0B44C` for elevated-not-yet-owner
- Hairlines `#1C232C` / `#1F2630`, 6–10px radii, 32–36px controls
- IBM Plex Sans + IBM Plex Mono
- Compact operational rows, inspector rails, evidence chips, policy tags
- “Ask your business…” as a product verb

---

## What Aurora refuses (REMOVE)

- 64px TWIN / CAUSE / TIME / ACT icon rail
- 56px header with a 380×34 global input
- Engine names as primary navigation
- Generic white / warm-paper Control OS (the previous light Aurora pass)
- ChatGPT green send disc, chat-history IA, consumer greeting
- CRM / ERP / analytics chrome
- Decorating the shell in orange
- Making the whole UI a developer console (mono on headlines)
- Green “success” for AUTO send (send ≠ solved)

---

## Color

| Token | Hex | Use |
| --- | --- | --- |
| `--aurora-canvas` | `#07090C` | Page |
| `--aurora-nav` | `#090C10` | Sidebar |
| `--aurora-surface` | `#0E1217` | Panels |
| `--aurora-surface-raised` | `#141A22` | Controls, chips |
| `--aurora-surface-active` | `#1A212B` | Active nav |
| `--aurora-ink` | `#E8ECF1` | Primary text |
| `--aurora-secondary` | `#A3ADBA` | Meta |
| `--aurora-muted` | `#7C8796` | Eyebrows, timestamps |
| `--aurora-attention` | `#FF5A1F` | Need you, primary act, NOW |
| `--aurora-attention-hot` | `#FF7A45` | Orange clause, focus, hover |
| `--aurora-watch` | `#F0B44C` | Monitoring / WATCH |
| `--aurora-auto` | `#7FB2E0` | AUTO, handled, streaming |
| `--aurora-on-attention` | `#0A0C0F` | Text on orange buttons |

Orange on dark text is `#0A0C0F`, never white-on-orange.

Events / Graph / Detect / Impact / Control **do not get their own palettes**.

---

## Type

**IBM Plex Sans** — interface, briefings, object titles, buttons.

**IBM Plex Mono** — only:

- timestamps
- IDs (`SH-204`, `FIN-02`)
- policy codes
- status chips
- financial / technical traces
- sync / model metadata
- execution-log verbs

Do not set 40px event counts or H1s in mono. The HTML over-used it; Aurora narrows it.

Optional Instrument Serif is **not** in this Control OS pass. The prototypes and `app/layout.tsx` already share Plex. One UI sans.

---

## Motion

- LIVE / NEED YOU pulse: 1.8s, orange, only on attention.
- `prefers-reduced-motion`: no pulse, no flow dashes.
- No page-level parallax. No neon glow.

---

## Components (shell primitives)

Reuse the HTML grammar, not the HTML files.

| Primitive | Spec |
| --- | --- |
| Primary button | 32–36px, `#FF5A1F`, ink `#0A0C0F`, 6px radius |
| Ghost button | raised surface, `#2A333F` border |
| Why? | Ghost. Opens contextual Causal |
| Status chip | Mono 10–11px, letter-space ~0.08em, word + mark |
| Policy tag | AUTO (ice) · APPROVAL_REQUIRED (orange) · BLOCKED (quiet) |
| Evidence chip | BANK / MODEL / POLICY — or business-source labels |
| Composer | Max 840px, surface, “Ask your business…” |
| Inspector | 320–380px, recessed rows, mono keys |
| LIVE pill | 8px pulse + LIVE. Freshness, not identity |

---

## Voice

| Use | Example |
| --- | --- |
| Briefing | Good afternoon. **2 decisions** need you today. |
| Situation | Atlas Supply delay · AT RISK — NOT MISSED |
| Command | Ask your business… |
| Act | Protect everything at risk this week. |
| Honesty | Computed 1.2s ago. Streaming. Send ≠ solved. |

Do not say “dashboard,” “inbox,” “module,” or engine names in the chrome.

---

## How this combines A + B + C + D

| Source | What the shell takes |
| --- | --- |
| **A** Legacy HTML | Dark DNA, orange discipline, Plex, Ask your business, inspector, policy tags |
| **B** ChatGPT / Mobbin | Quiet labeled sidebar, large workspace, overlay command, progressive disclosure |
| **C** Repo architecture | Five destinations; engines stay in `lib/`; seed objects; no hardcoded impact as truth |
| **D** Aurora | Tokens + brandbook + one shell |
