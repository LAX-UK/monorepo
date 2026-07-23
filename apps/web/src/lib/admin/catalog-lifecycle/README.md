# Admin catalog lifecycle (web)

Server actions that mutate sale/lot/submission lifecycle must be imported from
`admin-catalog-lifecycle-mutations.ts` in client components (Next.js `"use server"` boundary).

Capability gating uses `resolveCatalogLifecycleCapabilities` with `SALES_ACCESS` / `LOTS_ACCESS`.

View-model helpers under this folder stay serializable and unit-tested; pages remain thin loaders.
