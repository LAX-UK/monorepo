# Saleroom admin rollout contract

## Pipelines (server loaders)

| Route | Loader | Serializable page model |
| --- | --- | --- |
| `/admin/saleroom` | `loadSaleroomHubPage` | `SaleroomHubPageModel` |
| `/admin/saleroom/[saleId]` | `loadSaleroomClerkPage` | `SaleroomClerkPageModel` |
| `/admin/sales/[id]/operations` | `loadSaleroomOperationsPage` | `SaleroomOperationsPageModel` |

Routes stay **compose-only**: call a loader, map errors to existing shells, pass props to client components.

## Live state ownership

| Concern | Owner | Notes |
| --- | --- | --- |
| Session status, current lot, hammer/advance | WebSocket saleroom channel | Authoritative for clerk console transitions |
| Operations counters, paddle roster, telephone rows | Bounded HTTP polling | Client fetchers use shared Zod parsers in `lib/data/http/admin-*.schema.ts` |
| Reconnect / tab focus | Snapshot hydration | Poll/read snapshot once; WS events win if newer |

## HTTP readers

- **Server**: `admin-saleroom.reader`, `admin-sale-registrations.reader`, `admin-operations-snapshot.schema`
- **Browser**: `operations-snapshot.client.ts` (same parsers, no `admin.server` from feature code)

## Capabilities

- Hub + clerk: `SALEROOM_ACCESS` (layout gate)
- Sale operations tab: saleroom delivery mode + catalog sale detail loader (existing sale access)
