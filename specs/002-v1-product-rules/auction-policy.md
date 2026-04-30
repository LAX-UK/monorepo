# V1 Auction Policy

## Strategy Scope

- V1 product-facing auction interactions support **English strategy only**.
- Non-English strategies (Dutch, sealed, buy-it-now) are out of V1 product scope.

## Non-English Handling Policy

- Existing data/schema may retain non-English enum values.
- V1 UX and default operational flows must not expose non-English strategy creation paths.
- Any legacy/non-English lots should be treated as non-primary flows and excluded or clearly gated in V1 product experiences.

## Sale Delivery Modes

### Online

- Fully interactive auction behavior.
- Bidding is allowed under normal policy constraints.

### Onsite

- Marketing/read-only for bidding.
- Bidding is blocked.
- Non-bid engagement interactions (follow/watch/interest-type behavior) remain available where implemented.

## Consistency Requirements

- Backend policy and frontend UX must reflect the same online/onsite behavior.
- Error and messaging for onsite bid attempts must be explicit and consistent.
