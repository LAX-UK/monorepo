# Buyer account web boundary

Dashboard and account settings pages should import buyer-facing loaders, actions, and view-model builders from **`@/lib/buyer-account`** rather than reaching into `data/http/*` directly.

Payment list, compliance gate, fulfilment reads, checkout server action, and source-of-funds buyer view live in **`payments.server.ts`** (server-only). Payment display helpers and `MyPaymentRow` types are on the main barrel for pages and client components.

`getServerDataContainer()` sources payment loaders through `@/lib/buyer-account/payments.server`.
