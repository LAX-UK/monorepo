# Client workspace: wireframe copy check (GAP-56)

Five phrases from the approved client workspace wireframes were not found in code. This records where each stands.

**Limit of this check.** The approved wireframes are not in the repository (a search of `docs/` and `docs/design` for client workspace, consignment, estimate and wireframe finds none). Outcomes below compare the phrases to the shipped consignment screens only. No copy was changed, because nothing in the repo shows the shipped wording contradicts an approved wireframe. Whoever holds the wireframes should confirm the rows marked (a).

Outcomes: **(a)** screen exists with different but equivalent wording; **(b)** screen exists with contradicting wording (copy changed); **(c)** state or screen missing (not built).

| Phrase | Outcome | Evidence |
| --- | --- | --- |
| Review and accept | (a) | The agreement state exists. The step reads "Accept the agreement below and we catalogue the work for its sale." (`apps/web/src/lib/seller/consignment-next.ts`) and the button reads "Accept agreement" (`apps/web/src/components/dashboard/seller/consignment-agreement-panel.tsx`). |
| Edit and resubmit | (a) | The changes-requested state exists ("Needs changes" badge, `apps/web/src/lib/seller/consignment-status.ts`; `components/dashboard/seller/submission-changes-requested-panel.tsx`). The wizard's final button is "Send back for review" (`components/dashboard/submission-wizard/submission-wizard.tsx`). "Resubmit with updates" is used only for rejected work (`components/dashboard/submission-rejection-panel.tsx`). |
| Waiting for the gallery to accept | (c) | No state where the seller has proposed something and the gallery must accept. The only acceptance state is the seller accepting the gallery's agreement (`consignment-status.ts`, status `agreement`). |
| Estimate proposed | (a) | The agreement carries an estimate range and commission (`apps/web/src/lib/seller/consignment-agreement-parse.ts`, `consignment-checklist-facts.ts`). Before acceptance the row shows the estimate, or "Estimate after review" (`consignment-records.ts`). No "proposed" label. |
| Specialist estimate | (a) | The estimate is the specialist's terms (`consignment-status.ts`, `ConsignmentStatusFacts.agreement`) and shown as "estimate" (`consignment-records.ts`). No "Specialist" qualifier. |
