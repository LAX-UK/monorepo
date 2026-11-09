# Route JavaScript budgets

Every Next app (`apps/web`, `apps/shop`, `apps/art`, `apps/account`) is audited after `next build`.
For each page route the check adds up the gzip size of the scripts the route loads first: the root
main files plus the entries in `app-build-manifest.json`. Code fetched later by a dynamic import is
not counted.

Budgets live in one file, `scripts/route-js-budgets.json`, per app and route group (public pages,
lot or product pages, checkout, account). A group's budget applies to every route in it. The staff
admin area and dev pages are not audited.

## The budgets are a ratchet, not the goal

The approved checkout-design target for Bid public pages is **300 KB gzip first-load JavaScript**.
The numbers in the JSON file are not that target. Each is the largest route in its group at the time
the check was added, plus 10%: a ratchet at today's size that stops the pages getting heavier while
they are brought down. When a page is slimmed, lower its group's budget to the new size plus 10%
(`--suggest`), so the gain cannot be lost again. A group is on target when its budget is at or below
300 KB, and the ratchet is finished when the Bid public group gets there.

## Running it

```sh
pnpm --filter @auction/web build          # any app you want to audit
pnpm check:route-js-budget                # summary, plus the over-budget routes
node scripts/check-route-js-budget.mjs --all --app apps/web   # every route
node scripts/check-route-js-budget.mjs --suggest              # largest route + 10% per group
node scripts/check-route-js-budget.mjs --enforce              # fail on over-budget routes
```

An app without a build is skipped. CI runs the check in the `build` job straight after the build, so
it reuses that output.

## Warn now, fail later

While `"enforce": false` in the config, a route over budget prints a table and a GitHub warning
annotation, and the job passes. Set `"enforce": true` to make the same routes fail the job. For a
single run, pass `--enforce` or set `BUDGET_ENFORCE=1`; either turns enforcement on even when the
config says false. Exit codes: 0 pass or warnings only, 1 over budget under enforcement, 2 bad usage
or config.

## Raising a budget on purpose

A budget goes up only when the extra JavaScript is a decision, not drift.

1. Look for the cause first: `--all` shows which route grew, and `ANALYZE=true pnpm --filter
   @auction/web build` opens the bundle analyzer. A dynamic import for a dialog, editor or chart
   often removes the growth.
2. If the growth stays, run `--suggest` for the new size and edit `budgetKb` for that app and group
   in `scripts/route-js-budgets.json`. Round up to a whole KB and keep the headroom to about 10%.
3. Say why in the pull request description: what was added, why it cannot load later, and the
   before and after sizes. A reviewer approves the budget change like any other code change.

To move a route to another group, change the group's `match` patterns. They are regular expressions
tested against the route path with its `/page` suffix removed, for example
`/(marketing)/lot/[slug]/[id]`; the first matching group wins, and routes that match none join the
app's `fallback` group.
