# Xero: saved connection can no longer be read

Bid admin > Finance > Xero when the stored Xero tokens cannot be opened with the current
`XERO_TOKEN_DEK_KEY` (stored before the key was set, or sealed with another key). The page shows
the not-connected state with Connect Xero and one line explaining why, instead of failing to load.

Rendered from the real `XeroIntegrationPanel` with fixture data in `next dev` (no API behind it),
at 375 and 1440 px, light and dark, 2x. Named `reconnect-required-{width}-{theme}.png`.
