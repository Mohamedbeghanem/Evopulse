# Aurora design (approval, not production)

This folder is the **design track**. It does not change frozen engines, PR #14, or PR #15.

Open the prototypes:

```bash
# from repo root
python3 -m http.server 4173 --directory design/prototypes
```

Then visit [http://localhost:4173](http://localhost:4173).

| File | Master |
| --- | --- |
| `prototypes/index.html` | Product map + design index |
| `prototypes/pulse.html` | Pulse — one situation, one card |
| `prototypes/command.html` | Command — AgentRuntime live operation |
| `prototypes/warning.html` | Warning — AT RISK, not missed |

Specs:

- [AURORA.md](./AURORA.md) — tokens, type, components, voice
- [PRODUCT_MAP.md](./PRODUCT_MAP.md) — screens and ownership
- [MASTERS.md](./MASTERS.md) — Pulse / Command / Warning composition
- [APPROVAL.md](./APPROVAL.md) — what to approve before production UI

**Do not implement these into `app/` until the JPGs / HTML masters are approved.**
