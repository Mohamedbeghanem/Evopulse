# OpenManus (attribution)

EvoPulse's agent layer in `lib/agents/manus/` is a TypeScript port of the agent / flow / tool
architecture of **OpenManus**:

- Upstream: https://github.com/FoundationAgents/OpenManus
- Reference commit studied: `3309bf4e416fb1c74b008f3e86494439a31bad53` (2026-08-16)
- License: MIT — Copyright (c) 2025 manna_and_poem. Full text: [LICENSE](./LICENSE)

No Python code from OpenManus is vendored or executed. The port mapping, the EvoPulse-specific
governance changes, and what was deliberately left out are documented in
[docs/OPENMANUS.md](../../docs/OPENMANUS.md).
