# Staff dashboard rollout evidence

Status: **calm refinement shipped** — progressive disclosure, restrained summary metrics, full-width inbox (2026-07-27).

## Completed in this change

| Gate                       | Evidence                                                                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Calm page hierarchy        | Personalized title, quiet subtitle, icon-only Customize, 4-metric summary with expand                                                     |
| Progressive disclosure     | Operational context collapsed by default; auto-summary when live/blockers present                                                         |
| Minimal inbox chrome       | Filter sheet, active-filter summary only, no persistent chip rows                                                                         |
| No nav-count chip row      | Sidebar/header badges remain SSOT; dashboard no longer loads synthetic attention rows                                                     |
| Quiet rows/cards           | 3-column table, secondary meta line, one primary action + overflow menu                                                                   |
| Full-width inbox           | Side rail removed; context moved below inbox                                                                                              |
| Shared KPI builder         | `build-dashboard-kpi-tiles.ts` reused by summary + full band                                                                              |
| Work items API             | `GET /admin/work-items` — reader, service, SLA policy, route tests                                                                        |
| Sale readiness API         | `GET /admin/sales/readiness` — reader, service, route tests                                                                               |
| Inline + bulk actions      | Only context-free, fully supported mutations are exposed. Compliance/KYB/withdrawal reviews and shipping route to their detail workflows. |
| Failure semantics          | Work-item source and sale-readiness HTTP failures render unavailable slices; partial/empty data is not presented as healthy.              |
| Anomalies folded into KPIs | `apply-anomaly-kpi-tones.ts`; standalone anomalies toggle removed                                                                         |
| Telemetry                  | `work_item_action` event in `dashboard-telemetry.ts`                                                                                      |
| Role E2E subset            | `admin-dashboard-roles.spec.ts` — work inbox headings + read-only action boundary                                                         |
| Performance baseline doc   | `staff-dashboard-performance-baseline.md` + capture script                                                                                |

## Assignment ownership (v1 scope)

Real ownership exists on `item_submission.assignedToUserId` and `admin_review_task.assignedToUserId` only. Mine/Unassigned is applied in those source queries before source limits and is selected through the dashboard URL; Mine excludes kinds without ownership. Other kinds remain visible under All/Unassigned. A platform-wide work-ownership model is deferred until usage warrants it.

## Residual risk (explicitly pending)

| Gate                           | Blocker                                                                                                                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma reconciliation           | Canonical frames not created — see `staff-dashboard-prototype-validation.md`                                                                                                                                                      |
| Representative user tasks      | No timed task protocol results                                                                                                                                                                                                    |
| Linux visual baselines         | `admin-home-*` PNGs not refreshed/reviewed — matrix Visual = pending                                                                                                                                                              |
| Compliance officer E2E         | No seeded `compliance_officer` user in dev seed                                                                                                                                                                                   |
| Production performance proof   | ≤10% critical-content regression not measured on CI hardware                                                                                                                                                                      |
| Axe on drawer/bulk bar         | Manual axe pass on preview drawer + bulk bar recommended before release                                                                                                                                                           |
| Global inbox pagination/counts | Results still merge bounded per-source reads (maximum 50 rows per source), so counts and cross-source ordering can truncate under unusually deep queues. Correct distributed keyset pagination is deferred pending measured need. |

## Rollback

Revert UI commit only; retain API correctness fixes (work-items, sale readiness, submissions trend, batched saleroom radar) in separate commits when possible.

Trigger rollback if: critical-content regression >10%, dashboard error rate increase, capability leakage, failed a11y/role gates, or worse validated task outcomes.
