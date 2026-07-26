# Web data boundary

`apps/web/src/lib/data` is the web application's data-access boundary.

- Server Components and loaders read through `*.server.ts` modules or server
  data containers.
- HTTP transport lives under `http/**`; UI components do not call `fetch`
  directly.
- Mutations use Server Actions and services selected by
  `write-container.server.ts`.
- Wire/domain data is mapped to stable UI contracts in `view-models/**`.
- Client queries are reserved for realtime, optimistic, or explicitly approved
  shared-cache flows; see `.cursor/rules/client-state-layering.mdc`.

Keep pages and components dependent on narrow reader/writer capabilities rather
than concrete HTTP clients or a full container. See
`docs/architecture/domain-logic-placement.md`,
`docs/ui/view-model-conventions.md`, and `scripts/check-web-guardrails.mjs`.
