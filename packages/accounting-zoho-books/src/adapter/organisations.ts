import type { DestinationBinding } from "@auction/accounting-domain";

/**
 * The one place each writing mode's Books organisation is named, per product: reviewed in code,
 * not typed into a deployment's settings. A document aimed at `test_org` or `live` can only ever
 * reach the organisation named here for that mode and product (the sender checks every call), and
 * the organisation settings must agree with it when the process starts: an organisation named
 * here under `live` can never be configured as a `test` one, or the reverse
 * (`parseBooksDestinationBinding`).
 *
 * Empty until the test organisations are created and their ids confirmed: a mode or product not
 * named here has nowhere to go, so nothing is sent to Books in `test_org` or `live` (fail closed).
 */
export const BOOKS_ORGANISATIONS: DestinationBinding = Object.freeze({});
