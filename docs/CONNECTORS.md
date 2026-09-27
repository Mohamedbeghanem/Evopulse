# Connectors & Plugins

Approved by Emma (owner) as an explicit exception to `docs/FEATURE_FREEZE.md` ("new integrations / connectors").
Connectors are adapters **around** the frozen loop. They do not add an engine, a second Autopilot state
machine, or a command router.

```
source connector ─▶ entities / graph / events / expectations ─▶ (existing) Detect ▶ Pulse ▶ Autopilot …
agent (AgentRuntime) ─▶ plugin tool ─▶ READ: run, output = untrusted DATA
                                    └▶ WRITE: actions row ▶ Policy ▶ human approval ▶ Policy RECHECK ▶ call ▶ action.executed
outbound channel     ─▶ connector_outbound action ▶ Policy (external_message_requires_approval) ▶ approval ▶ adapter.send
```

## Pattern taken from OpenManus (not its code)

OpenManus (`FoundationAgents/OpenManus`, `app/tool/base.py`, `tool_collection.py`, `mcp.py`) models every
capability as a `BaseTool` (name, description, JSON-schema `parameters`, `execute`), keeps them in a
`ToolCollection` keyed by name (duplicates skipped, unknown names fail), and proxies each MCP server tool as an
`MCPClientTool` whose name is prefixed with the server id.

EvoPulse keeps that shape and adds governance:

| OpenManus | EvoPulse |
| --- | --- |
| `BaseTool` + `parameters` | `PluginToolSpec` (`name`, `description`, `inputSchema`, `permission`) |
| `ToolCollection.tool_map` | `ConnectorRegistry.enabledTools()` / `findTool()` per workspace DB |
| `MCPClientTool` `mcp_<server>_<tool>` | `plugin__<install>__<tool>`; can never shadow a core tool |
| `MCPClients.connect_sse/stdio` | Streamable HTTP only (JSON or SSE replies). **No stdio**: registering a server never spawns a process |
| any tool runs | `readOnlyHint: true` → READ; anything else → WRITE → Policy + human approval (fail closed) |
| tool output fed back to the model | output is bounded, redacted, flagged if it reads like an instruction, marked `untrusted` |

Plugin tools are resolved by the existing executor (`lib/agent/executor.ts`) after the core registry, and the
DeepSeek/OpenRouter loop sees their schemas next to the core tools. The model gateway is unchanged.

## Manifest

`lib/connectors/types.ts` — `id`, `name`, `kinds` (`source` | `outbound` | `tool`, primary first), `category`,
`capabilities`, `readScopes`, `writeScopes`, `config` (typed fields: text / url / number / boolean / secret, each
optionally backed by an env var). Built-ins live in `lib/connectors/manifests.ts`.

Storage is the **workspace DB** (`connector_installs`, `connector_runs`, `connector_outbox`). Secrets are sealed with
AES-256-GCM (`EVOPULSE_SECRETS_KEY`, else a 0600 key file next to the control DB), never returned to the client
(the UI only sees `set` / `env` / `unset`), and redacted from errors, runs and audit logs.

## Built-in connectors

| Connector | Kind | Needs | Env vars (optional) |
| --- | --- | --- | --- |
| CSV / Excel import | source | nothing | — |
| Email (IMAP) | source | host, user, password | `EVOPULSE_IMAP_HOST`, `EVOPULSE_IMAP_PORT`, `EVOPULSE_IMAP_USER`, `EVOPULSE_IMAP_PASSWORD`, `EVOPULSE_IMAP_MAILBOX`, `EVOPULSE_IMAP_TLS` |
| WhatsApp Business (Cloud API) | source + outbound | phone number id, access token, verify token, app secret | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` |
| MCP server (many) | tool | URL, optional Authorization | `EVOPULSE_MCP_ALLOW_PRIVATE=true` to allow private/loopback URLs (dev only) |
| Local outbox | outbound | nothing | — |

Env credentials are process-wide, so they only apply to workspaces listed in
`EVOPULSE_CONNECTOR_ENV_WORKSPACES` (comma-separated workspace ids, or `*` for a single-tenant deploy). Otherwise
configure per workspace in **Connectors & Plugins**. Without credentials a connector shows **Not configured** and
does nothing — no fake data.

### CSV / Excel

`.csv` (comma / semicolon / tab) or `.xlsx`, ≤ 5 MB, ≤ 5000 rows. Preview maps headers by alias, validates
(required fields, numbers, dates, duplicates) and writes nothing. Import writes the same tables the engines read:
`entities` (+ `graph_nodes`), `graph_edges` (`belongs_to`, `produces`, `billed_to`, `supplies`, `required_by`),
`events` (`order.created`, `payment.expected`, `payment.received`, `order.delivered`, `*.imported`) and
`expectations` (`source_type = connector`) for open orders / unpaid invoices with a due date. The existing Detect
clock turns a missed one into an exception and Pulse shows it. Imports are idempotent (stable ids, idempotent
events, fulfilled expectations are not reopened).

Detect's non-graph fallback impact was the Atlas 320K opportunity; for connector expectations it now uses the
imported record's own amount (`lib/connectors/impact.ts`, one guarded branch in `lib/engine/matcher.ts`).

### Email (IMAP)

`Sync now` pulls UIDs after the stored cursor (≤ 50 per run) and records each as `message.received`
(`source = email-imap`), matching sender email to an imported customer / supplier. Text is data.

### WhatsApp

Webhook: `GET/POST /api/connectors/whatsapp/webhook?workspace=<workspace id>`. GET answers the Meta
`hub.challenge` only for the configured verify token. POST requires a valid `X-Hub-Signature-256` from the app
secret, an enabled connector, and records inbound texts as `message.received` (`source = whatsapp-cloud`,
idempotent on the WhatsApp message id). Outbound is the `whatsapp-cloud` adapter, used only by approved
`connector_outbound` actions.

### Outbound interface

`lib/connectors/outbound.ts` — `OutboundAdapter { id, channel, label, isConfigured(), send() }` and
`registerOutboundAdapter()`. Adapters only send; governance decides. A future drafts / outbox pipeline
(`feat/demo-loop-outcomes`) can register its adapter here.

## Governance

- `connector_write`: always `APPROVAL_REQUIRED`; a `percent` / `discount` argument above `discount_max` is `BLOCKED`.
- `connector_outbound`: follows `external_message_requires_approval` (approval by default).
- Approval must come from a human: actors like `agent`, `autopilot`, `model`, `system` are refused; `approve_action` stays forbidden to the model.
- Policy is rechecked immediately before the call; a policy change after approval still wins.
- Execution records `action.executed` with `handled: false`. Nothing here writes HANDLED.
- `/api/actions/[id]/execute` refuses connector actions so the engine executor never marks them executed without the call.

## Routes

`GET /api/connectors` · `POST /api/connectors/:installId {action: configure|enable|disable|test|sync|remove}` ·
`POST /api/connectors/mcp` · `POST /api/connectors/import/preview|commit` (multipart `file`, optional `type`) ·
`POST /api/connectors/actions/:actionId {decision}` · WhatsApp webhook above. Configure / remove / MCP need owner or
admin; the rest need a writer. The demo company is read-only.
