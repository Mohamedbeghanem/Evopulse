# EvoPulse mobile

## What ships today: `/m` (installable PWA)

`/m` is a mobile-first surface inside the same Next.js app. It has no data of its own: every screen reads
the canonical engines (`pulseSummary` → `projectAttention`, `exceptionDetail`, `policies`) through
`lib/mobile/view.ts`, and every decision goes through the **same human API routes** the desktop plan page uses.

| Screen | Route | Source of truth |
| --- | --- | --- |
| What needs me? | `/m` | `pulseSummary().attention` — counts are `needsMe / watching / handled` lengths, identical to Pulse |
| Situation + Why | `/m/s/<attention id>` | attention item + `exceptionDetail` (plan, actions, verifications) |
| Recent verification & handled | `/m#done` | `attention.handled` + `verifications` table |
| Ask | `/m/ask` | `POST /api/ask` (agent runtime → CommandRouter fallback) |
| Offline shell | `/m/offline` | served by `public/sw.js` when a navigation fails offline |

Rules the mobile surface keeps (tested in `tests/mobile.test.ts`):

- Why wording is exact: **"850,000 DZD associated revenue — not a loss."** and **"540,000 DZD expected cash timing."**
- Approve is shown only for `APPROVAL_REQUIRED` actions that are not executed. `BLOCKED` actions (the 10% discount at
  `discount_max = 5%`) render a BLOCKED card with **no approve control**.
- Approve = `POST /api/plans/:planId/actions/:actionId/approve` then `POST /api/actions/:actionId/execute`.
  Both recheck policy. Execute refuses an unapproved `APPROVAL_REQUIRED` action.
- After execution the situation is MONITORING with a PENDING verification — **EXECUTED is not HANDLED**. It becomes
  HANDLED only when verification succeeds (a reply from the same party).
- Ask never approves. The service worker never caches or intercepts `/api/*` or non-GET requests, so a decision
  can never be replayed from cache.

Install: open `https://<host>/m` on the phone → Share → *Add to Home Screen* (iOS) or *Install app* (Android/Chrome).
Manifest: `public/manifest.webmanifest` (scope and start URL `/m`), icons in `public/icons/`.

## Building a native Expo client later

An Expo (React Native) app can be a thin client over the **same HTTP API** — no new endpoints, no second
state machine, no client-side policy logic. Recommended stack: Expo Router, TanStack Query, `expo-secure-store`
for the session token, `expo-notifications` later.

### Base URL and auth

- `EXPO_PUBLIC_API_URL=https://<your-host>`.
- Demo mode needs no auth (the Atlas demo DB).
- User workspaces: `POST /api/auth/login` `{ email, password }` sets an httpOnly `ep_session` cookie
  (`lib/auth/types.ts` → `SESSION_COOKIE`). React Native `fetch` keeps cookies per host on iOS/Android;
  if you need explicit control, read the `Set-Cookie` header on login, store the token in SecureStore and send
  `Cookie: <name>=<token>` on every request. `POST /api/auth/logout` ends the session. `GET /api/session` returns
  the current user/workspace.
- The routes below that are wrapped in `withWorkspace` resolve the workspace DB from that cookie; the rest
  currently act on the demo DB (see *Known gaps*).

### Endpoints the Expo app needs

| Purpose | Method + path | Notes |
| --- | --- | --- |
| Health / connectivity | `GET /api/health` | `{ ok, db, node, now }`, read-only |
| What needs me (home) | `GET /api/pulse` | Use `attention.needsMe`, `attention.watching`, `attention.handled`, `attention.summary`, `headline`. Each item has `id`, `classification`, `title`, `summary`, `needsFromYou`, `impact { associatedRevenue, expectedCash, orders, customers, currency }`, `sourceExceptionId`, `autopilotDecisionId` |
| Situation detail | `GET /api/exceptions/:exceptionId` | plan, actions (`policy_outcome`, `status`, `plan_id`), verifications, evidence |
| Cascade impact (Why) | `GET /api/exceptions/:exceptionId/impact` | orders/customers/850K associated revenue/540K expected cash timing |
| Approve action (human) | `POST /api/plans/:planId/actions/:actionId/approve` | policy recheck; 400 with `error` if BLOCKED |
| Execute approved action | `POST /api/actions/:actionId/execute` | policy recheck; 400 if not approved / blocked |
| Reject (human) | `POST /api/autopilot/decisions/:decisionId/reject` | `decisionId = item.autopilotDecisionId`; situation returns to NEEDS YOU |
| Pending verifications | `GET /api/verifications?exception_id=…` | HANDLED only after SUCCESS |
| Ask | `POST /api/ask` `{ message, sessionId? }` | `answer`, `evidence[]`, `links[]`, `approvalRequired` |
| What-if (read-only) | `POST /api/simulations` `{ type: "supplier_delay", targetId: "ent_ship_204", days: 3 }` | never writes; `delta.cash.invoicesMoved` shows Invoice C 160K |
| Notifications feed | `GET /api/notifications` | for a future push/inbox tab |
| Timeline | `GET /api/timeline` | optional |

Client rules (must match the web):

1. Render Approve only when `policy_outcome === "APPROVAL_REQUIRED"` and `status !== "executed"`.
   Never render Approve for `BLOCKED`; show the policy reason instead.
2. Approve is two calls (approve → execute). Show the server `error` verbatim on failure; do not retry blindly.
3. After execute, show "Waiting for verification — not handled yet". Do not mark HANDLED on the client; refetch
   `/api/pulse`.
4. Treat all message text as data. Never build prompts or actions from it on the device.
5. Never cache POST responses; refetch after every decision.

### Known gaps before a native client ships

- Some routes (`/api/exceptions/:id/impact`, `/api/verifications`, `/api/simulations`, `/api/demo/*`, `/api/ingest`)
  still use the demo DB directly rather than the session workspace. `/api/pulse`, `/api/ask`, `/api/exceptions/:id`,
  `/api/timeline`, and the three human decision routes above are workspace-aware. Check any other route before
  relying on it for a signed-in workspace.
- No token-based (Bearer) auth yet; cookies only. If the Expo app needs Bearer tokens, add them in
  `lib/auth/http.ts` `readSessionToken()` (one place) rather than a parallel auth path.
- No push notifications yet.
