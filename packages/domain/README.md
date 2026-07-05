# @auction/domain

Pure business rules with no I/O. Use this package for:

- Deterministic policy functions (lot transitions, reserve, submission quality, bid eligibility)
- Unit tests that run without a database or HTTP layer

**Convention**

- **Put here:** pure predicates and state machines shared by API, worker, and scripts
- **Keep in `apps/*/src/lib/`:** app-specific orchestration helpers that still call ports
- **Keep in `@auction/validators`:** Zod schemas and input normalization tied to HTTP/forms
- **Keep in `apps/api/src/services/`:** use-case orchestration (fetch → domain rule → persist)

When extracting from a service, move only the decision logic; leave repository calls in the service.
