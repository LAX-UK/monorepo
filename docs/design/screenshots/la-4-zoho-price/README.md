# Price in Zoho (LA-4)

Screenshots of the "Price in Zoho" row on the From Zoho record and the optional column on the All
list (hidden by default), light and dark, 1440 and 375 px, at 2x. Named `{view}-{width}-{theme}.png`.
Rendered from the real components with fixture data (names are made up).

The 375 px record shots run from the top of the page to just below "Price in Zoho", so the row
shows on a phone. On the All list the price is a desktop-only column (`mobile: "hidden"`), so the
375 px list shots look the same with the column shown or hidden.

Sorting by "Price in Zoho" is done by the server across every page (`sort=zohoPrice` or
`sort=-zohoPrice` in the URL), with works Zoho has not priced last in both directions.
