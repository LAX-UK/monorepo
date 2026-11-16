# Not collected tab: states

Playwright screenshots of the Not collected tab's states, rendered from the real components and
the app's compiled styles, at 1440 and 375 px wide, light and dark. Files are named
`{state}-{width}-{theme}.png`.

States: `list` (charging off), `list-charging-on-more` (charging on, list cut short),
`empty`, `loading`, `error` (with Try again), `read-only`, `extend-errors` (Extend dialog with two
errors) and `waive-errors` (Waive dialog with one error, charging off). No horizontal scroll at
375 px in any of them.

The two dialog states (`extend-errors`, `waive-errors`) are viewport-only captures taken with
reduced motion, after the dialog has settled.
