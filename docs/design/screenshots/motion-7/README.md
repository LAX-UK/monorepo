# Motion 7: staff tools

Real renders of the two staff tools from production builds of `apps/web` and `apps/shop-admin`.
They ran against a local seeded stack (Postgres, Redis, API, identity, shop-api) and were captured
in Chromium with Playwright. The LAX Admin record panel is the audit log's `DetailPanel`.

## Recordings

| File | What it shows |
|---|---|
| `bid-admin-cover-slot-switch-realtime.webm` | Bid admin, sale → Content → Cover and home: switching Default → Wide → Phone → Default at real speed |
| `bid-admin-cover-slot-switch-slowed-10x.gif` | The same switches with the page's animations slowed 10x (DevTools `Animation.setPlaybackRate`). The selected border changes at once and the panel fades in on the staff enter token (150ms) |
| `lax-admin-record-panel-realtime.webm` | LAX Admin audit log: opening and closing a record panel at real speed |
| `lax-admin-record-panel-slowed-10x.gif` | The same open, slowed 10x: a fade on the staff panel token (200ms), with no slide |

## Resting screens, main and this branch

`{screen}-{width}-{theme}-{main|head}.png`, at 1440x900 and 375x812, light and dark, with reduced
motion so nothing is caught mid-animation. `main` is `origin/main` and `head` is this branch, both
built and served the same way against the same database.

| Screen | What it shows |
|---|---|
| `bid-admin-cover` | Bid admin sale cover tab: the three slot tabs and the Default panel, in the staff shell |
| `lax-admin-audit-list` | LAX Admin audit log list, in the staff shell |
| `lax-admin-audit-panel` | The same list with a record's `DetailPanel` open |

Every main and head pair is pixel-identical: `screenshotDiffRatio`
(`apps/web/e2e/helpers/motion-check.ts`) gives 0.00000 on all 12 pairs, below the
`RESTING_PARITY_MAX_DIFF_RATIO` of 0.001. Nothing changes at rest.

The seeded sale's cover pictures point at remote storage that a local stack cannot reach, so the
preview frames on the cover tab show the browser's broken-image icon on both main and head.

## How to check the motion

The opt-in motion checks run against a seeded stack:

```bash
pnpm --filter @auction/web test:e2e:motion        # includes e2e/tab-motion-bid-admin.spec.ts
pnpm --filter @auction/shop-admin test:e2e:motion # e2e/overlay-motion.spec.ts and e2e/panel-motion.spec.ts
```
