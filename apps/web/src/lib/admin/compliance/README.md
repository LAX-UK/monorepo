# Admin compliance rollout contract

## Pipelines

| Route | Loader | Model |
| --- | --- | --- |
| `/admin/compliance/aml` | `load-aml-list-page.ts` | AML list page model |
| `/admin/compliance/source-of-funds` | `load-sof-list-page.ts` | SoF list page model |
| `/admin/compliance/source-of-funds/[id]` | `load-sof-case-detail-page.ts` | `SofCaseDetailPageModel` |

## Maker-checker capabilities

| Capability | AML | SoF |
| --- | --- | --- |
| `AML_REVIEW_ACCESS` | Triage | Triage |
| `MLRO_DECISION_ACCESS` | Decide | Decide / reopen |

Use `resolveComplianceCapabilities()` in loaders, actions, and boards — do not duplicate `userHasAccessTo` checks.

## Document security

Evidence download/review stays on server actions and signed URLs; client components must not construct storage paths.
