# Design approval

Approve these artifacts before any production React rewrite.

## Approve

1. [ ] Aurora tokens and voice (`AURORA.md`)
2. [ ] Product map and nav cut (`PRODUCT_MAP.md`)
3. [ ] Pulse master (`prototypes/pulse.html`)
4. [ ] Command / AgentRuntime master (`prototypes/command.html`)
5. [ ] Warning master (`prototypes/warning.html`)

## JPG capture (for reviewers)

Open each prototype at 1440×900 and export:

- `pulse.jpg` — both cascade and 320K cards visible
- `command.jpg` — run trace and approval dock visible together
- `warning.jpg` — AT RISK / NOT MISSED and 14h / 18h / 4h visible

HTML is the source of truth. Do not treat generated art as the spec.

## Pass bar

- Pulse shows **two** needs-me cards after supplier delay (cascade + 320K), never three.
- Cascade card shows 3 / 3 / 850,000 / 540,000 and says associated / expected cash timing.
- Command shows a run trace and a human approval dock.
- Warning says **NOT MISSED**.
- No “revenue saved.”
- No production files under `app/` or `lib/` changed in this track.

## After approval

Production UI implementation may restyle Pulse, Command, and Warning against these masters. Engines stay frozen.
