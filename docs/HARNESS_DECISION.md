# DeepSeek Harness integration decision

**Date inspected:** 2026-09-27  
**Decision:** MODE C — keep the current governed conceptual adapter. Do not import or embed official DeepSeek Harness.  
**Owner:** AgentRuntime (`lib/agent`). Command Center talks only to `AgentRuntime`.

This is the hackathon-safe choice. Official Harness is a developer-preview coding-agent product. It cannot be privilege-limited to EvoPulse's governed business tools through a clean official API.

## Official Harness repo

| Field | Value |
| --- | --- |
| Repository | https://github.com/deepseek-ai/deepseek-harness |
| Product page | https://www.deepseek.com/harness/en/ |
| Docs | https://deepseek-harness.github.io/deepseek-harness/ |
| Default branch | `master` |
| Inspected tag | `dsh-v0.1.7-rc.2` |
| Inspected version | `0.1.7-rc.2` (`@deepseek-ai/dsh-root` / `@deepseek-ai/dsh`) |
| Inspected commit | `477b4f420553e8a52c2fbccc464d7561b239c443` |
| HEAD of `master` (same SHA) | `477b4f420553e8a52c2fbccc464d7561b239c443` — `release(dsh): 0.1.7-rc.2` |
| License | MIT |
| Status | Developer preview. README: **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.** |
| npm `@deepseek-ai/dsh` | `0.1.7-rc.2` published; npm `latest` dist-tag still points at `0.1.5-rc.3` |
| Safety notice | https://github.com/deepseek-ai/deepseek-harness/blob/master/SAFETY.md |

EvoPulse `HARNESS_REFERENCE` in `lib/agent/types.ts` already pins this exact version and commit (`isolated-adapter`). The live re-audit confirmed the pin.

## What was inspected

Read from source on `master` @ `477b4f420553e8a52c2fbccc464d7561b239c443`, plus npm registry metadata:

- `README.md` — `npx @deepseek-ai/dsh web` launches a local coding-agent workbench (default `127.0.0.1:3080`).
- `AGENTS.md` — package map: `shell`, `fs`, `subprocess`, `ssh`, `terminal`, `sandbox`, `computer-use`, `browser-use`, `credentials`, `mcp`, `sdk`. Public APIs are **pre-stable**. Session format generations do not imply fallback or downgrade.
- `package.json` — workspace `@deepseek-ai/dsh-root` version `0.1.7-rc.2`.
- `SAFETY.md` — not security-audited; not production-ready; can execute model-generated code and commands; can reach network, processes, credentials, and files; sandbox/approvals **do not guarantee isolation**.
- `docs/architecture.md` — everything-is-a-plugin Cordis tree. Supported Node apps launch only through named `dsh` profiles (`web`, `headless`, `sdk`, `sdk-minimal`, `acp`). **Direct in-process plugin mounting is not a supported application launcher.** TypeScript SDK resolves a same-version `dsh` and selects the `sdk` profile, then drives a subprocess.
- `packages/sdk/README.md` — official extension path is newline-delimited JSON-RPC that **spawns a complete Harness runtime**. Clients open sessions, send prompts, and observe session events. They do not replace the default tool surface with a foreign allowlist.
- `docs/subsystems/tools.md` — tool registry + guarded execute pipeline. Useful conceptually. Not an embeddable “only these tools” host API for a third-party product.
- Product page modes — Standard / Code / Minimal / Creator. **Minimal still ships persistent bash + `str_replace_editor`.** Code mode exposes a TypeScript SDK that can combine multi-step tool calls. None of these modes is “EvoPulse business tools only.”
- npm `@deepseek-ai/dsh` dependencies include `@deepseek-ai/dsh-tool-bash`, `@deepseek-ai/dsh-tool-fs`, `@deepseek-ai/dsh-fs-local`, `@deepseek-ai/dsh-terminal`, `@deepseek-ai/dsh-tool-web`, credentials, MCP, and profile bundles.

Official session logs record everything the model sees, including reasoning. EvoPulse must persist only operational trace (command, tools, approvals, execution, verification). Hidden chain-of-thought is forbidden.

## Decision gate

| Mode | Meaning | Chosen? |
| --- | --- | --- |
| A REAL ADAPTER | Import official extension APIs and run Harness in-process with **only** EvoPulse governed tools | No |
| B SIDECAR | Spawn `dsh` / `@deepseek-ai/dsh-sdk-client` in a separate process | No |
| **C CURRENT GOVERNED ADAPTER** | Keep `DeepSeekHarnessRuntime` as a conceptual loop over EvoPulse tools + `ModelProvider`. No `@deepseek-ai/dsh*` dependency | **Yes** |

### Why MODE A is not clean

There is no official API that says: “construct a Harness agent whose only tools are this foreign allowlist, with shell/fs/git/SQL/env/credentials/network/deploy removed, and persist only operational events.”

- In-process Cordis mounting is explicitly **not** a supported launcher (`docs/architecture.md` Application launch).
- Default profiles and `dsh-base` mount model adapters, persistence, sandbox, **credentials**, and coding tools.
- `sdk-minimal` is still a Harness-owned SDK tree launched by `dsh`, not an isolated library EvoPulse can call.
- Public APIs are pre-stable and advertised as compatibility-breaking.
- Privilege isolation would require a custom profile/bundle that strips `tool-bash`, `tool-fs`, `tool-web`, terminals, computer-use, browser-use, MCP, credentials, and git-adjacent packages — then keep that tree working across RC bumps. That is not a clean official extension.

MODE A would import a coding-agent plugin tree into a business control system. Privileges cannot be isolated.

### Why MODE B is not safer

The official sidecar **is** the coding agent.

- `@deepseek-ai/dsh` / `@deepseek-ai/dsh-sdk-client` spawn `dsh --profile sdk` (or `web` / `headless`).
- That subprocess reads `~/.dsh/`, writes session JSONL (including reasoning), and exposes bash/fs/web by default.
- `SAFETY.md` says sandboxing does not guarantee isolation and must not be the sole security control.
- A hackathon demo must not give the model a shell, filesystem, git, SQL, env, credentials, network, or deploy surface — even in another process on the same host.

Process separation without a privilege-limited official profile is still a coding-agent sidecar. EvoPulse forbids that.

### Why MODE C

EvoPulse already has the parts that are stable enough to learn from, implemented without Harness source:

- `AgentRuntime` — `run` / `resume` / `cancel` / `getStatus` / `getTrace` / `requestApproval` / `resumeAfterApproval`
- Governed tool registry — READ / PREPARE / EXECUTE_SAFE / HUMAN_REQUIRED / FORBIDDEN_TO_AGENT
- Loop, repeat, timeout, and cancel guards
- Provider-backed conceptual loop (`DeepSeekHarnessRuntime`) that calls **only** `listBusinessToolSchemas()` + `invokeTool`
- `DeterministicRuntime` fallback when the provider is missing, throws, times out, or returns no valid tools

No official Harness import. No vendored tree. No `@deepseek-ai/dsh*` in `package.json`. Command Center and `/api/ask` import `getAgentRuntime()`, never Harness classes.

## Privileges

| Capability | Official Harness (default / Minimal / SDK) | EvoPulse MODE C |
| --- | --- | --- |
| Isolated to EvoPulse tools only | **NO** | YES |
| `shell` / bash / pwsh | YES (default; Minimal keeps bash) | Forbidden |
| Filesystem write / editor | YES | Forbidden |
| git | YES (coding-agent workspace) | Forbidden |
| SQL | Possible via shell | Forbidden (`execute_sql`) |
| env / credentials | YES (`credentials` package, `DEEPSEEK_API_KEY` in Harness home) | Provider keys stay in process env; never a tool |
| Network / web fetch | YES (`tool-web`) | Forbidden |
| Deploy | YES (shell + network) | Forbidden |
| Computer / browser use | YES (Standard / Creator) | Forbidden |
| Self-approve actions | Harness approval UX is product-owned | `approve_action` is FORBIDDEN_TO_AGENT |
| Persist chain-of-thought | YES (session log = model-visible history) | NO — operational trace only |

**Privilege isolation via official APIs: NO.**

## Runtime mapping (conceptual adapter only)

| `AgentRuntime` | MODE C behavior |
| --- | --- |
| `run` | Provider loop over governed tools, or `DeterministicRuntime` if provider missing/fails |
| `resume` | Continue the deepseek loop, or fall back |
| `cancel` | Mark cancelled; cooperative cancel between steps; fallback cancel if the run already left the adapter |
| `getStatus` | Load persisted run |
| `getTrace` | Persisted operational steps only |
| `requestApproval` | Return current run (human gate is a tool + stored approvals) |
| `resumeAfterApproval` | Apply human decision through the executor |

## Failure contract

Verified in `tests/harness-adapter.test.ts` (and overlapping cases in `tests/agent-runtime.test.ts`):

| Failure | Required outcome |
| --- | --- |
| Crash / provider throw | Fall back to `DeterministicRuntime`; `fallbackUsed` |
| Timeout / abort | Treated as provider failure; fall back |
| Invalid / unknown / forbidden tool | Failed or `forbidden`; no shell/SQL/fs execution |
| Repeat identical calls | Stopped (`loopLimit` / `repeated`); run fails closed |
| Cancel | `status = cancelled`, `phase = CANCELLED` |
| Provider unavailable / empty valid tools | Fall back to deterministic operating path |
| Loop limit | Fail closed; no unbounded tool storm |

If Harness, the model, or the provider is disabled, missing, upgraded, or on fire, EvoPulse keeps working.

## READY

**READY = YES (MODE C).**

- Official Harness evaluated at `0.1.7-rc.2` / `477b4f4`.
- MODE A and MODE B rejected: privileges cannot be isolated.
- No official Harness dependency added.
- Governed adapter remains behind `AgentRuntime`.
- Crash / timeout / invalid tool / repeat / cancel / fallback tests exist.
- Command Center does not import Harness classes.
