# PR 1365 screenshots, round 2

Seeded local stack (fresh throwaway database). Documents and agreement target: signed in as the seeded owner of Northbank Gallery, acting for it. Watching: a seeded client with watched lots.

## Overlay badge ("1 Issue" in round 1)

Not reproduced. On the local stack, search "a" → open a lot → Back at 375px and 1440px leaves the URL at `?q=a`, the search box restored, no console error or warning from the page (apart from the unrelated websocket/image-fetch failures of a stack without the ws service and without internet), and the Next.js dev overlay shows no issue count (checked by reading the overlay's shadow DOM, not only by eye). So this PR does not cause a hydration mismatch, setState-during-render or duplicate key on /watching.

The only overlay issue seen while preparing these shots was on the documents page and came from a stale build of `@auction/ui`: `React does not recognize the actionBeside prop on a DOM element`, which disappeared after rebuilding the package. A local stack running against an out-of-date `packages/**` build can show a "1 Issue" badge of that kind; I could not tie round 1's badge to anything else.

## Documents (/organisation/documents)

- `documents-375-light.png`: the download button now sits on the row's own line, right-aligned, 44px square (measured), beside the title and facts. No empty band under the row.
- `documents-1440-light.png`: unchanged layout at 1440, now including a consignment agreement row.
- `agreement-target-1440-light.png`: the page the agreement row opens (/selling/consignments/...).

The seed has no consignment agreements. For these shots only, one accepted agreement was inserted straight into the local throwaway database (no seed files changed).

The fix is an opt-in `actionBeside` prop on `RecordRow`; other rows are untouched.

## Watching

- `watching-after-back-375-light.png`, `watching-after-back-1440-light.png`: searched "a" (URL `?q=a`), opened a lot, pressed Back; search and URL restored, no overlay badge.
