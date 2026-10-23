# @auction/lax-ecosystem

Cross-product contracts and pure view models shared by Bid, Shop, Art and LAX Account.
Nothing here performs I/O.

## Portfolio read contracts (V1)

`LaxPortfolioItemV1` describes one work a person holds, and `LaxMoneyEntryV1` one line of
their money. Each is a TypeBox schema with a matching static type, exported from
`src/lax-portfolio-contract.v1.ts`.

### Who does what

- Each product implements the contract for its own data and decides what its statuses mean.
  It exposes the result read-only, scoped to the signed-in person.
- The Account BFF fetches from every product, validates the response against the schema and
  composes the page. It never copies or stores product data.
- The presenters in this package (`buildPortfolioHeader`, `buildHoldings`, `buildMoney`,
  `portfolioEmptyState`) turn validated items into the view models the pages render.

### Rules the shapes encode

- Amounts are integer minor units with an ISO 4217 currency on every line. There is no
  cross-currency total anywhere: sums are always per currency.
- `business` is the legal entity that owns the record (`lax_bid` or `lax_art`; LAX Shop
  belongs to LAX Art). House stock is never part of a client contract.
- "Paid so far" is the cost basis of works that have been paid for: hammer, premium, VAT,
  fees and price. Shipping is carried as its own line and excluded from the basis. It is a
  statement of fact, not a valuation, and no gain or loss is derived from it.
- Money is grouped by business and direction. What you owe is never netted against what you
  are owed.
- A document that is not `available` has no `href` and may carry an `expectedNote`.

### Versioning

The suffix is the contract version. Within V1 a change must be additive and optional: a new
optional field, or a new member of an enum that consumers already treat as open-ended.
Anything that removes a field, narrows a type, or changes what a field means ships as
`LaxPortfolioItemV2` / `LaxMoneyEntryV2` in a new file next to V1. Products serve both until
every consumer has moved, then V1 is deleted. Consumers must validate responses against the
schema and treat an invalid payload as that product being unavailable, never as an empty
portfolio.
