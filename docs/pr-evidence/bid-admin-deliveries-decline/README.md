# Bid admin Deliveries: "Can't deliver" (GAP-47, D8; D9 step 3)

Shot by `apps/web/e2e/admin-deliveries-decline.spec.ts` against the local stack as the PR browser
gate builds it (Postgres 16, migrations, `db:seed:local`, roles, API, auth issuer and the built
web app), signed in as the seeded Administrator. The journey adds its own made-up sale, won lot
and request and removes them afterwards. 1440 × 1000 and 375 × 812, light and dark. Named
`{state}-{width}-{theme}.png`. All names and addresses are made up; the lot thumbnail is the
"No photo yet" placeholder.

| State | Scenario |
| --- | --- |
| `1-dialog` | Can't deliver opened from the panel footer: focus on "Reason for the buyer" |
| `2-reason-missing` | Submitted empty: the message under the one field, no error summary |
| `3-stale` | The buyer withdrew and asked again while the dialog was open: the D6 stale Notice from a real `quote_changed`; nothing declined, the panel reloaded behind it |
| `4-declined` | Declined as the request is now: "Declined by LAX" badge and timeline step, the reason in the Quote section, no footer action |

Going from the side panel at 1440 to the phone panel at 375 draws the panel again, which closes
a dialog open in it, so the journey opens the dialog again at each width before shooting.
No state scrolls sideways at 375.
