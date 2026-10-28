# lax.art Figma inventory

Design source of truth: [LAX.art rebuild](https://www.figma.com/design/JvWqZrAeu8r8fs5EfjDlRc/LAX.art-rebuild), page `72:2` "UI - In Progress".

Figma decides **what** exists: screens, sections, content order, states. The shared system decides **how** it is built: `@auction/ui`, `@auction/marketing-ui`, `@auction/branding`, and the "Apple model" rule in [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

Last updated 2026-10-22 against `main` @ `96d140f35`, plus pull requests #551 (collector hub, guides, venues, how to buy) and #552 (Art hub, stories index, article related content), which are documented here as built. Status meanings:
- **Built**: matches Figma.
- **Partial**: route exists; the deltas column lists what differs.
- **Missing**: no route or section.

Code paths are relative to `apps/art/src/`.

**Theme contract.** Use semantic tokens from `app/base.css` only. `base.css` is the only Art stylesheet allowed raw hex; `verify-art-theme` (`scripts/ci/verify-art-theme.test.mjs`) enforces this. Light/dark preference persists via `ArtThemeInit` and `ArtThemeToggle`.

**Composition rule.** Controls come from `@auction/ui` and `@auction/marketing-ui`. `scripts/check-ui-guardrails.mjs` rejects raw controls in `apps/art/src`. A control that Figma needs and the packages lack is added to the shared package, with a test, and is never built locally. See [Shared primitives added](#shared-primitives-added).

## Owner decisions (2026-10-21)

Where Figma and these decisions disagree, the decisions win.

| # | Topic | Decision |
| --- | --- | --- |
| 1 | Typefaces | Keep Montserrat and Outfit. Figma's DM Sans headings are set in Montserrat at Figma's sizes and weights. No new font is loaded. |
| 2 | Colour | [LAX colour rule](../DESIGN_SYSTEM.md#lax-colour-rule-one-palette-one-accent-per-product): navy belongs to Bid only. Figma's navy CTAs, active pills and progress fills use the shared neutral (obsidian/ink) on Art. Art's own accent is to be chosen. |
| 3 | Page gutters | There is one shared gutter token, `MARKETING_PAGE_GUTTER_X`, and no per-product override. It moves to the Figma values (16px mobile, 24px tablet, 40px desktop), the common mobile standard, in its own PR, with before/after screenshots of Shop, Bid and Art. |
| 4 | Footer | Keep the shared `MarketingFooter` and its shared column order. Art supplies Figma's links inside those columns: About us → site nav, Our services → site nav, Policies → Legal, Contact us → Connect. Keep LAX products. Figma content, shared structure. |
| 5 | Final versions | **Home desktop:** `285:2928`, which has the combined LAX.bid + LAX.shop band the designer's note asks for. Its promo imagery comes from the CMS, so the `614:12622` versions are content, not code. **Mobile:** one responsive page in the same section order as desktop; only layout changes (rails, dots, app bar), never content order. Native-only chrome in "Mobile app" frames (iOS status bar) is ignored. **Catalogue tiles:** come from data (departments that have stock), so the 3-tile vs 4-tile difference resolves itself. |
| 6 | Guest enquiries | Guests can enquire, as Figma shows. Signed-in users get editable prefilled name, email and phone. The server validates with Zod and protects the endpoint with a honeypot field and per-IP and per-email rate limits. Figma's privacy note is shown. The shop-api change ships before the UI change. |
| 7 | Profile and settings | LAX Account owns identity: profile, email change, phone book, addresses, notification preferences, privacy and delete account. Figma's Edit account and Settings screens are built in `apps/account` with the shared primitives. Art shows a read-only summary and deep-links to them. Art keeps only Art data: favourites, enquiries, collection. |
| 8 | Spelling | British English stays: Favourites, Enquiries. LAX is London-based and these routes are shipped. US paths keep their 301 redirects. |
| 9 | Loading boundaries | Routes that change their own query string (catalogues, artists A–Z, exhibition tabs, search) have no `loading.tsx`. A React race in Next 15.5 can stall those navigations in production; enforced by `apps/art/src/lib/routing/query-navigation-routes.test.ts`. |

## Frame matrix

The Deltas column lists only what still differs from Figma. A "Built" row has no remaining delta other than the intentional ones named.

### Global chrome

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Navigation (desktop component set) | `521:7889` | header | Built | Utility row (products, theme toggle, Log in or account menu, Enquire), mega menus for Artists (portrait preview), Artworks and Exhibitions, and an inline search shelf with recent searches and suggested artists. Intentional differences: Art keeps the theme toggle and has no bag icon. Figma's "Mu Account" variant is a stale LAX.bid header, so there is no signed-in header spec. |
| Footer (in every desktop frame) | `235:226` | footer | Partial | Figma content sits inside the shared column order (decision 4). Figma links with no Art route are left out: Our history, Careers, Press, Sitemap, Bidding policy. |
| Bottom Navigation Bar (mobile) | `546:9946` | bottom nav | Built | Floating inset pill with a filled active tab (`MarketingBottomTabBar` `variant="floating"`). The label stays "Favourites" (decision 8). |
| Page title (mobile app bar) | `489:3970` | mobile pages | Missing | Back + title + share/overflow. Mobile uses the global header and drawer instead. The artwork page has its own "More options" sheet, built locally rather than as a shared app bar. |
| Page titel (component) | `875:19061` | list and editorial pages | Partial | `MarketingPageTitle` (plain band and media variants) is used by the collector hub, guide index, visit, how to buy and sell, contact, exhibition detail, stories and the artist hero. `/artists`, `/artworks` and the account pages still use the left-aligned `ArtPageHeader`. |

### Home (`614:12594`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Home page v1 | `235:225` | `/` | Built | Sections in Figma order: hero, What's on across LAX (full-width wide lead plus three), Curators' picks, Featured artists, LAX.bid and LAX.shop band, Featured stories, guide promo, Our galleries, closing enquiry band. Sections without data are hidden. The horizontal stacked-story card Figma draws beside the featured story is not built; the existing editorial card is used. |
| Home page v1 (alternate) | `285:2928` | `/` | Built | The combined LAX.bid and LAX.shop cream band is built, and the closing band uses the plain tone where Figma draws midnight (decision 2). |
| Versions | `614:12622` | `/` | Partial | The "Across LAX" product doors (`MarketingProductDoors`, shared with Bid and Shop) close the home page and Art Hub, LAX Shop first. Each door shows its product's lockup, accent and permanent illustration (`@auction/branding/images/product-doors`); the `home_promo_bid` and `home_promo_shop` placements may override its title, promise and image. Links come from `@auction/lax-ecosystem`. |
| Mobile app | `337:7878` | `/` (mobile) | Partial | One responsive page in desktop order (decision 5). Not built: Private Sales band, Auctions Picks (live Bid lots) and dot indicators on rails. |
| Mobile app (viewport) | `396:11666` | `/` (mobile) | Partial | As `337:7878`; the different section order is not followed (decision 5). |
| Mobile responsive (web app) | `314:4765` | `/` (mobile web) | Partial | "Next sale" line on the LAX.bid promo needs Bid auction data. |

### Search (`826:13529`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Search open (header) | `826:14147` | header overlay | Built | Inline field, clear control, recent searches and suggestions. Suggestions are the featured artists already loaded for the mega menu, not a curated "Top searches" list. |
| Search found | `826:14746` | `/search?q=` | Built | Centred title, filter sheet, link tabs Available / Sold / Exhibitions / Articles with counts, "n results" line and sort. A single "Artist: name" link replaces the Artists section when a name matches exactly. |
| Search not found | `826:15255` | `/search?q=` | Partial | "Create alert" is not shown; it needs a saved-search service. |
| Search empty (mobile) | `886:18755` | `/search` | Built | Pill field, prompt and "Browse all" card. |
| Search, regular user (mobile) | `886:14042` | `/search` | Missing | Recent searches exist in the header shelf only; there is no recently-viewed list. |
| Search not found (mobile) | `895:18920` | `/search?q=` | Partial | As desktop. |

### Artworks catalogue (`614:11120`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| All artworks (grid) | `538:4885` | `/artworks` | Partial | Built: Filters trigger with a right-hand drawer, Medium / Rarity / Price range dropdowns, view switcher, portrait cards with inline heart, regular-weight title and underline Enquire. Differences: the tile rail is "Browse by medium" (object types), not departments; the price dropdown uses preset bands. |
| All artworks List | `881:21945` | `/artworks?view=list` | Built | Large landscape media, divider, price + heart + outline Enquire column. |
| Filters (drawer spec) | `541:6507` | `/artworks` | Partial | Multi-select accordions with Cancel / Apply are built. Department, painting technique and framed filters, and the oldest-first sort, have no data. |
| Drop Down | `543:6997` | `/artworks` | Built | `MarketingFilterDropdown` with checkboxes and Cancel / Apply. |
| All artworks (drawer open) | `546:8592` | `/artworks` | Partial | The tiles here read Originals / Prints & Multiples / Watches / Jewellery, which differs from `538:4885`; tiles come from data (decision 5). |
| All artworks (dropdown open) | `546:9125` | `/artworks` | Built | As Drop Down. |
| Type of artworks | `587:9412` | `/paintings` `/prints` `/sculptures` | Partial | Image hero, no tiles. Figma is department-based ("Originals"). Cards have Enquire. |
| Artworks cards (mobile) | `546:9559` | `/artworks` | Partial | Mobile cards show title, heart and artist only (CSS-only trim). Not built: "Discover Lax" title and the shortcut strip (Exhibitions, Artists, types). |
| Artworks list (mobile) | `905:22051` | `/artworks?view=list` | Partial | Uses the large list row; Figma's mobile row omits heart and Enquire (unverified in the browser). |
| Bottom sheet (mobile filters) | `551:10071` / `561:6647` | `/artworks` | Built | "Reset all" / "Show results" on the mobile sheet. |

### Artwork detail (`614:12570`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Artwork page | `426:2581` | `/artworks/[slug]` | Partial | Built: breadcrumb (Artworks / type / title), spec table, certificate link, "Enquire to purchase", Share, About / Exhibition-history tabs, accordions, artist block with Follow and Read more, "More in this collection" rail. Missing: "View in room"; the "Private Sales" breadcrumb level (no data). |
| Artwork page (scrolled) | `433:4845` | `/artworks/[slug]` | Built | Sticky info column on desktop. |
| Mobile app | `468:7996` / `468:8877` | `/artworks/[slug]` | Partial | Swipe gallery, accordions, artist block, rail and a fixed Follow and Enquire bar are built. Not built: FAQ pills, vertical dot indicators. The price stays visible in the info column, unlike Figma. |
| Menu / menu bottom sheet | `905:21131` / `905:21586` | `/artworks/[slug]` | Built | "More options" sheet: Share, More from this category, Contact a specialist (opens the general enquiry sheet with topic `art_advisory`). |
| FAQ bottom sheet | `905:21656` | `/artworks/[slug]` | Missing | Needs a FAQ entity (see Follow-ups). |

### Enquiry (`614:12202`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Send enquiry (artwork) | `531:8496` | `/artworks/[slug]` sheet | Built | Guests and signed-in users; editable name, email, phone and message; privacy note; honeypot and rate limits (#544). Availability alerts ("notify me") still need sign-in. |
| Send enquiry (general) | `614:12257` | header ENQUIRE | Built | `ArtGeneralEnquirySheet`, opened from the header Enquire link, the home closing band, the artist sell prompt and the artwork options sheet. |
| Inquire bottom sheet / focused | `531:9043` / `533:9469` | mobile sheet | Built | Same sheet as a bottom sheet. |
| Validation error (mobile) | `606:10621` | mobile sheet | Built | Inline name and email validation. |
| Enquiry sent (mobile) | `616:12737` | mobile sheet | Built | `MarketingSuccessState` animated check, static under reduced motion. |

### Artists (`614:12542`, plus `1057:18576` in Art hub)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| All Artists | `1057:18576` | `/artists` | Partial | Built on the shared LAX artist directory (`MarketingArtistDirectory`, as on LAX Bid and LAX Shop): title band with search and A–Z, a Show filter rail on desktop and a filter sheet on phones, result count, A–Z / Recently added sort, removable chips, and portrait cards with Follow and a works count. Not built: category tile rail and Type-of-art / Nationality filters (the artist list API has no such facets); centred page title. |
| Artist profile | `439:6125` | `/artists/[slug]` | Partial | Built: full-bleed hero with nationality and life span and outline Follow, sticky anchor tabs, biography with Read more, Featured works, Originals band, Exhibitions, Films & stories, "Interested in selling a work by …?" opening the general enquiry sheet. Missing: "Represented by LAX" badge (no data flag). Films use the editorial card because story summaries carry no `videoUrl`. |
| Section (LAX.bid promo) | `459:7359` | `/artists/[slug]` | Missing | Needs artist auction data from LAX.bid. |
| Mobile (Artworks tab) | `500:3615` / `521:7418` | `/artists/[slug]` | Partial | One responsive page with sticky anchor tabs rather than Artworks / About tabs. No app-bar back and share over the image; no floating Follow pill. |
| Mobile (About tab) | `511:6867` / `521:7686` | `/artists/[slug]` | Partial | The same content appears as sections of the single page. |

### Exhibitions (`614:11014`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Exhibitions | `561:7003` (dup `1066:15039`) | `/exhibitions` | Partial | Split-slide reveal hero with dots, Current / Upcoming / Past tabs and 3-column cards with "Exhibition \| venue" kicker and dates are built. Not built: Filters trigger (no real filter exists), card hearts (no backend), time of day and city on the reveal slide (summary lacks them). The page heading is visually hidden. |
| Exhibition page (current) | `743:20964` | `/exhibitions/[slug]` | Partial | Built: media title hero, facts row, overview, works (first 8, then View more), featured artists, installation views, press rows, private-viewing band that opens the enquiry panel. The hero leads with the exhibition subtitle and the contact column names the specialist, falling back to the venue phone and email (#557). Differences: the location is a map link, not an embedded map; press rows have no publication kicker. |
| Exhibition page (closed) | `737:20593` | `/exhibitions/[slug]` | Built | "Closed" eyebrow from the end date; plain CTA band. |
| Exhibition page (scrolling) | `574:8039` | `/exhibitions/[slug]` | Built | Sticky sub-nav with identity and tabs Overview / Works / Featured artists / Press, only for sections that render. |
| Exhibition Overview (mobile) | `599:7263` | `/exhibitions/[slug]` | Partial | Same tabs on one page, with the "Exhibition specialist" card (#557). Not built: the "How to find us" map. |
| Artworks & Artists (mobile) | `601:7820` | `/exhibitions/[slug]` | Partial | Works and artists sections are built; the count and filters row is not. |
| Press (mobile) | `606:10398` | `/exhibitions/[slug]` | Partial | Press rows are built; the publication kicker needs a field. |
| Collect (mobile) | `606:8465` | `/exhibitions` (mobile) | Partial | Mobile "Collect" hub with the Exhibitions tile selected; this is not an exhibition tab and has no separate route. |

### Art hub and stories (`635:13357`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Arthub | `980:26767` | `/art-hub` | Partial | Built (#552): hero with quick links, Happening now rail, stories rail, spotlight artists, podcast with audio player, a film, Collecting 101 panel, black press band, LAX.shop and LAX.bid cards. Each section is hidden without data. Differences: Happening now is a standard rail, not a full-bleed peek carousel; the stories rail is not mixed-size; films and the conversation panel wait on data not yet served. |
| All Stories | `1068:16594` | `/stories` | Built | #552: tabs All, Artist stories and films, LAX's podcast, Press as route segments (`/stories`, `/stories/artists`, `/stories/podcast`, `/stories/press`); cards kicked "CATEGORY \| DATE". The Filters control is not built. |
| Artist Stories | `1068:17219` | `/stories/artists` | Partial | Cards are built; the reveal conversation carousel is not. |
| Podcast | `1068:17562` | `/stories/podcast` | Built | #552: latest episode with `MarketingAudioPlayer`, then episode cards. |
| Press tab (named "Podcast") | `1068:17901` | `/stories/press` | Built | #552: press cards. |
| Article | `687:17324` | `/stories/[slug]` | Built | #552: byline, 53.75rem reading column with image and gallery blocks that break out to 75rem, audio player for podcast episodes, related content (a current or upcoming exhibition first, otherwise stories sharing the series or category). Related LAX.bid auctions are not shown (no Bid data). Sticky reading bar with thumbnail, Share and progress is built for every story. |
| Latest Stories (mobile) | `716:19075` | `/stories` | Partial | Single-column cards are built (#552); the app bar with filter is not. |
| Article (mobile) | `716:18901` | `/stories/[slug]` | Partial | Related content appears as cards; the inline artwork carousel with dots is not built. |
| Loose section patterns | `1005:19903` `1010:20286` `992:14944` `995:15825` `1068:18293` `1068:18351` `1068:18188` `1068:17020` | hub and stories | Partial | Press list rows, podcast hero and the Collecting 101 split feature are built through shared primitives. Not built: exhibition feature, featured-artist split, event feature, conversation, reveal slide and framed podcast, and no editorial block type covers them. |

### Collect hub, guides, visit, how-to (`780:8898`, `816:10177`, `921:13108`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Hub card (component set) | `782:11358` | — | Partial | `MarketingFeatureCard` (#551) covers split, vertical and text. The dark and overlay variants are not built. |
| Collect hub | `782:11154` | `/collector-hub` | Built | #551: two-column grid of cream split cards from `collector_hub_card` placements (title, body, CTA label, image, link) and a closing "Curious to learn more?" band to `/contact`. The Private Sales card links wherever its placement points; there is no private sales route. |
| 101 Guide | `782:11834` | `/collector-hub/101-guide` | Partial | #551: 3-column guide cards with "LAX GUIDE \| n MIN READ". The title band stays plain because pages have no cover image field. |
| Guide detail (named "Collect hub") | `782:14430` | `/stories/[slug]` (kind `guide`) | Partial | Hero, reading column and the sticky reading bar are built. The `heading` block has no number, so numbered section headings are missing. |
| Guide reading state | `782:15111` | same | Built | Sticky bar with thumbnail, title, Share and reading progress. |
| Collect hub (mobile) | `780:9171` | `/collector-hub` | Built | #551: stacked cards with a diagonal-arrow marker. |
| Guide (mobile) | `804:16104` | guide detail | Partial | Image-pair carousel with dots is not built. |
| Locations | `816:10184` | `/visit` | Built | #551: "Our galleries" 2-up venue cards (name, street, city, postcode). Title and intro come from an optional CMS page with slug `visit`. Hours and the private-viewing form moved to the detail page. |
| Location detail | `821:11603` | `/visit/[slug]` | Partial | #551: jump-to bar, icon fact rows (location, hours, phone, email), "View on Google Maps", current exhibitions and a "You may also like" band. Missing: embedded static map (no map provider) and the Story section (no venue-to-story relation). |
| Locations / detail (mobile) | `816:10442` / `816:10455` | `/visit`, `/visit/[slug]` | Partial | Hairline fact rows are built; the map is not. |
| How to buy | `921:13111` | `/how-to-buy` | Partial | #551: heading, prose and FAQ bodies map to numbered bordered step cards. Bodies that do not match that structure fall back to the authored rendering (the current seed body does). FAQ links and "Contact our team" point to `/contact` until a help centre exists. |
| Help answer (named "How to buy") | `923:13696` | `/help/…` | Missing | Needs a FAQ entity and route. |

### Favourites and account (`866:11034`, `867:16339`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Favorite Artworks empty | `867:15986` | `/account/favourites` | Partial | Centred title, Saves / Follows tabs as routes and the empty state are built. "You might like" is not built (no recommendation source). |
| Favorite Artworks filled | `866:11652` | `/account/favourites` | Partial | Saved artworks reuse the artwork grid. Saved Exhibitions has no backend. |
| Followed artists | `867:15613` | `/account/favourites/follows` | Partial | `MarketingFollowRow` with Following toggle is built. The life line and "Previewing 4 of n works" need a batched artist-works read. |
| Saved Artworks / Followed Artists (mobile) | `912:22916` / `914:23516` | `/account/favourites` | Partial | Tabs and rows are built; the "Artists" type select is not. |
| My account | `867:16367` | `/account` | Partial | Monogram band, Profile / Enquiries tabs, personal details with Verified pill, "Edit in LAX Account" deep link and help cards are built. Address management and phone book are not (decision 7: they belong in LAX Account, which has no API for them yet). |
| Enquiries | `871:17403` | `/account/enquiries` | Partial | One newest-first list merging artwork and general enquiries, status pill Awaiting reply / Replied. Missing: reference number, latest staff reply and artwork thumbnail (not in the enquiry contract); general enquiries have no status. |
| Account (mobile) | `928:13358` / `933:13593` / `930:14088` | `/account` | Built | Enquiries list, and the inverse "You're almost ready" banner for an unverified email or missing phone. |
| Edit account / email / notifications / privacy / contact (mobile) | `950:13732` `950:14072` `956:14230` `956:14309` `956:14392` | `apps/account` | Partial | Edit account (read-only view) and Privacy are built in Account (#543). Update email, notification preferences, contact and delete account deep-link to Bid, because Account has no API for them. |
| Settings (mobile) | `930:14289` / `930:15435` | `apps/account` | Partial | Built in Account at `/account` (#543). The Language row is omitted (Account has no i18n) and the theme follows the system setting. |
| Enquiry list item (component) | `872:17745` | — | Built | `MarketingEnquiryListItem` (default, artwork, compact). |
| Heart (component) | `866:14253` | — | Built | `MarketingHeartToggle` `appearance` (circle, bare, onMedia), `size` and a saved colour from `--color-favorite`. |

### Listed by the designer as not yet designed (`804:16663`, `834:11250`)

| Page | Route today |
| --- | --- |
| Sell with us | `/how-to-sell` (CMS + selling enquiry) |
| About / LAX | none |
| Contact | `/contact` |
| FAQs | none (see Help answer `923:13696`) |
| Legal: Privacy, Cookie, Terms, Accessibility | `/legal/[slug]` |
| Legal / regulatory information; Bidding policy (footer) | none |
| Private Viewing booking flow | enquiry topic `private_viewing` only |

Favorites and My account were on the not-yet-designed list but now have frames (above).

## Token deltas

Figma values come from `get_variable_defs`. Code values are from `packages/branding` and `app/base.css`.

| Area | Figma | Code | Status |
| --- | --- | --- | --- |
| Display face | DM Sans: SemiBold 60/1.2 page titles; Medium 40/48 section titles; 44 promo headlines | `BRAND_FONTS` is Montserrat / Outfit | Decision 1: Montserrat at Figma sizes. Page titles use `--text-display-lg` (`clamp(2rem, 4.2vw, 3.75rem)`, #538) |
| Body face | Montserrat | Montserrat | Match |
| Section title size | 40/48 | `--text-title-section` `clamp(1.5rem, 2.8vw, 2.5rem)` | Done (#533) |
| Primary CTA | Midnight #081F5B (most frames); black on some | `--color-primary` / `--color-cta-bg` obsidian | Done: obsidian stays (decision 2) |
| Midnight scale | 700 #081F5B, 600 #394B7B, 200 #CED2DE, 100 #E6E9EE | Removed from Art, Shop and Account links, focus rings, secondary and container tints | Done for Art (#533), Shop and Account (#550). `verify-art-theme`, `verify-shop-theme` and `verify-account-theme` guard it |
| Cream surface | Cream/100 #F1F0DF | `--color-surface-feature` and `--color-on-surface-feature` in `base.css` (#541) | Added |
| Inverse surface | Black sections (hub press, films) | `--color-surface-inverse` and `--color-on-surface-inverse` (#541) | Added |
| Saved heart | Red fill | `--color-favorite`, aliasing `--color-live-red` (#536) | Added |
| Product accent | — | `--color-product-accent` maps to the primary neutral in Art, Shop and Account; `PRODUCT_ACCENTS` in `@auction/branding` (#533) | Done. No accent chosen yet for Shop, Art or Account |
| Neutrals | 100 #F5F5F5, 300 #E1E1E1, 400 #CACACA, 500 #8E8E8E, 600 #4B4B4B, 700 #1F1F1F | Close but not equal; 400 and 500 missing | Open |
| Media radius | 0 (cards, images, hub cards) | Square corners on media | Done (#533) |
| Button / card radius | 6px / 8px | `--radius-md` / `--radius-lg` | Match |
| Button text | Mixed case, 16/24 and 14/20 Medium | Many variants uppercase-tracked | Open |
| Gutters | 40px desktop, 24px tablet, 16px mobile | `MARKETING_PAGE_GUTTER_X` is `px-4 md:px-6 lg:px-10`, shared by Shop, Bid and Art | Done (#534) |
| Reading column | 860px, prose 18/26 | Articles: 53.75rem column with 75rem breakout (#552); other editorial blocks use `max-w-prose` | Partly done |
| Page background | ~#FAFAFA (unbound, unverified) | #FFFFFF | Confirm with the designer |

## Shared primitives added

Every new or extended component in `@auction/marketing-ui` and `@auction/ui` from the Figma work. All changes are additive: defaults for Shop and Bid are unchanged. "Art routes" lists where the primitive renders; "adopt" lists the other products that should move to it (Shop and Bid import none of the new components today, except where noted).

### `@auction/marketing-ui`

| Primitive | Package | Used by (Art routes) | Other products should adopt |
| --- | --- | --- | --- |
| `MarketingPageTitle` (`plain` \| `media`, eyebrow, subtitle, chip, byline, `actions` slot) | marketing-ui | Collector hub, 101 guide, visit, how to buy and sell, contact, exhibition detail, stories, artist hero, account | Shop, Bid |
| `MarketingSubNav` (link and anchor modes, sticky identity bar, reading progress) | marketing-ui | Exhibitions index and detail, stories (reading bar), artist profile, account and favourites tabs | Bid (replace local `marketing-underline-tabs`), Shop |
| `MarketingSplitFeature` (tone, media side, `h1` option) | marketing-ui | Home promos and guide promo, artist sell prompt, Art hub (#552) | Shop, Bid |
| `MarketingCtaBand` (tone cream / plain, `media` option from #551) | marketing-ui | Home closing band, exhibition private viewing, collector hub closing band | Shop, Bid |
| `MarketingFeatureGrid` (`lead-plus-row`, `lead-plus-stack`) | marketing-ui | Home What's on and Featured stories | Shop journal, Bid press |
| `MarketingVenueCard` | marketing-ui | Home galleries, `/visit` | Bid venues |
| `MarketingEditorialCard` (aspects `landscape`, `portrait`, `wide`; kicker, detail lines, trailing slot) | marketing-ui | Home, exhibitions, stories, related content | Shop journal, Bid press |
| `MarketingEditorialListRow` (kicker, meta line, `linkAs`, inverse tone) | marketing-ui | Exhibition press, Art hub press band (#552) | Bid press |
| `MarketingRevealCarousel` (split slide, dots, never autoplays) | marketing-ui | Exhibitions index | Bid, Shop home |
| `MarketingFactColumns` (centred columns; `layout="list"` from #551) | marketing-ui | Exhibition facts, venue facts (replaces local `ArtVenueFacts`) | Bid venues |
| `MarketingFeatureCard` (split, vertical, text; #551) | marketing-ui | Collector hub, Art hub | Shop, Bid |
| `MarketingStepCard` (#551) | marketing-ui | How to buy | Shop, Bid |
| `MarketingAudioPlayer` (#552) | marketing-ui | Art hub podcast, stories podcast tab, podcast articles | — |
| `MarketingLinkList` (#552) | marketing-ui | Art hub quick links | — |
| `MarketingFilterDropdown`, `MarketingFilterFacetGroup` (draft state, Cancel / Apply, Reset all / Show results) | marketing-ui | Artworks catalogue drawer and toolbar, search filters | Shop, Bid |
| `MarketingHeaderSearch` (inline field, recent searches, suggestions) | marketing-ui | Header | Shop, Bid |
| `MarketingHeaderMegaNav` extended (`columns`, `linkHref`, item `media`) | marketing-ui | Header (Shop and Bid already use it) | Shop, Bid |
| `LaxFamilyBar` `actions`, `MarketingBottomTabBar` `variant="floating"` | marketing-ui | Header utility row (LAX top bar), mobile tab bar | Bid, Shop and LAX Account use the same top bar |
| `MarketingHeartToggle` extended (`appearance`, `size`, saved colour token) | marketing-ui | Artwork cards, list rows, artwork detail | Bid watch hearts |
| `MarketingCatalogListRow` extended (`size="lg"`, `aside` slot) | marketing-ui | Artworks list view | Bid, Shop |
| `MarketingSpecList` | marketing-ui | Artwork detail | Bid lot, Shop product page |
| `MarketingReadMore` | marketing-ui | Artist biography, exhibition artists | Bid |
| `MarketingArtistSummary` | marketing-ui | Artwork detail | Bid |
| `MarketingStickyActionBar` | marketing-ui | Artwork detail (mobile Follow and Enquire) | Bid lot, Shop product page (generalise `StickyBidBar`) |
| `MarketingFollowRow` | marketing-ui | Favourites, Follows tab | Bid artist watch |
| `MarketingEnquiryListItem` | marketing-ui | Account enquiries | Shop account |
| `MarketingSuccessState` (animated check) | marketing-ui | Enquiry sheets | Bid, Shop, Account |
| `MarketingSideSheet` `titleCase` option | marketing-ui | Enquiry sheets, artwork options sheet | Shop, Bid |
| `MarketingStatusState` `search-remove` motif | marketing-ui | Search no results | Bid, Shop |
| New icons in `marketing-icons.tsx`: map pin, calendar, arrow (and clock, mail from #551) | marketing-ui | Facts, cards, artwork detail | — |

### `@auction/ui`

| Primitive | Package | Used by (Art routes) | Other products should adopt |
| --- | --- | --- | --- |
| `ListRow` `href` / `asChild` | ui | Account settings and edit-account rows (`apps/account`); one Art file | LAX Account (replace local `Card` / `Row` / `StatusPill`) |
| `Alert` `inverse` variant | ui | Account banner (Art profile, LAX Account) | Bid |
| `Progress` small tweak for the reading bar | ui | Story reading progress | — |
| `Slider` `thumbLabel` (#552) | ui | Audio player scrubber | — |

### Still missing

From the earlier gap list, not built:
- `MarketingMobileAppBar` and an action sheet shared by all mobile frames.
- `MarketingHorizontalRail` `peek`, mixed-size and `dots` controls.
- `MarketingStickyActionBar`-style scroll-triggered Follow pill for the artist page.
- `MarketingContactCard` and `MarketingStaticMap` (blocked on a map provider).
- FAQ link, FAQ pill and FAQ sheet (blocked on a FAQ entity).
- Shared ecosystem cross-sell card (Art's home band is local).
- Recently-viewed rail (promote the local `recently-viewed-rail` in `apps/web`).
- `Button` mixed-case arrow link and a Figma-matched outline variant; `Avatar` monogram; `Badge` chip link; `Carousel` vertical dots and portrait aspect.
- Dark and overlay variants of the feature card.

### `@auction/branding`

Done: `PRODUCT_ACCENTS` and `--color-product-accent` (#533), the 16 / 24 / 40 gutters (#534). The surface-feature, surface-inverse and favourite tokens live in Art's `base.css` rather than the shared package. Open: align the neutral scale.

## Data and contract gaps

The sections that depend on missing data render only once it exists, and are otherwise hidden.

| Need | Status | Detail |
| --- | --- | --- |
| Editorial joins (exhibition to artwork / artist, story to artist / artwork / exhibition) | Resolved (#535) | Served by shop-api with a new `GET /v1/editorial/artists/:slug`. Join order is curated through `position` columns (#549). Shop Admin cannot edit the joins yet |
| Story `publishedAt`, author, read minutes, series / category, `podcast` kind, audio URL and duration, publication name | Resolved (#535, #549) | |
| Venue on exhibition summary; venue address lines, city and coordinates; exhibition subtitle and contact person | Resolved (#535, #549, #557) | Art shows the exhibition subtitle, specialist and venue city |
| Placement body and CTA label; slots for home promos, Art hub sections and hub feature | Resolved in the API (#549) | Collector hub cards use them (#551) and the Art hub uses the hub slots (#552). and the home band reads `home_promo_*` (#557) |
| Catalogue multi-value filters | Resolved (#539) | |
| Catalogue department, technique, framed, facet counts, oldest / relevance sort, private-sale flag | Open | Filters and departments for these are not built |
| Artist represented-by-LAX flag, original / non-original split, pagination, category and nationality filters | Open | Originals are fetched with one extra `type=original` read |
| Favourites: exhibitions; richer followed-artist rows | Open | Saved artworks and followed artists only |
| Enquiries: unified list | Resolved (#556) | Reference number, latest reply, thumbnail and general-enquiry status are still open |
| Guest enquiry | Resolved (#544) | Guests need no account; per-IP and per-email limits |
| LAX.bid artist link and upcoming / past lots read | Open | No shop-to-Bid artist mapping |
| FAQ / help entity with categories and search | Open | |
| Saved-search alerts, recommendations, recently viewed, private-viewing slots, view in room | Open | |

## Follow-ups

Everything below needs new data, a service, infrastructure or an owner decision. Each line gives the pull request that raised it.

### Catalogue, search and discovery
- Saved-search alerts ("Create alert" on no results). #540
- Free-form minimum and maximum price in the dropdown; today it offers preset bands. #539
- Recently viewed and a mobile recent-searches list. Figma `886:14042`
- Department, technique and framed filters and an oldest-first sort need catalogue data. #539

### Artists and artworks
- Artist category listing for the `/artists` tile rail and Type-of-art / Nationality dropdowns. #553
- "Represented by LAX" flag on the artist. #553
- LAX.bid artist auction data and the LAX.bid banner on the artist profile. #553
- Scroll-triggered Follow pill for the artist page on mobile. #553
- `videoUrl` on story summaries so films render as films. #553
- "View in room". #542
- Private Sales level in the artwork breadcrumb (needs a flag and a route). #542
- Help centre / FAQ entity (question, answer blocks, category, slug, search), a `/help/[slug]` route, artwork FAQ pills and sheet, and real targets for the how-to-buy step-card links. #542, #551

### Exhibitions, venues and stories
- Exhibition press kicker (publication name) and reveal-slide time of day. #554
- Filters on `/exhibitions`. #554
- Venue-to-story relation so the Location detail "Story" section can render. #551
- Static map image or embed: needs a configured map provider and a venue image field. #551
- Numbered guide headings: optional `number` or `ordinal` on `EditorialHeadingBlockSchema`. #551
- Private sales route (the hub's Private Sales card has no destination). #551
- Art hub: "Happening now" as a full-bleed peek carousel and the mixed-size stories carousel (needs a `MarketingHorizontalRail` peek variant); films section and conversation panel need data not yet served. #552
- Story `publishedAt` in the media hero. #538

### Favourites and saves
- Saved exhibitions, and hearts on exhibition and story cards (needs backends). #536, #554, #556
- "You might like" recommendations. #556
- Followed-artist life line and "Previewing n of m works" (batched artist-works read). #556

### Enquiries
- Enquiry reference number, latest staff reply and artwork thumbnail in the enquiry contract. #556
- Emit guest enquiries to CRM (the worker mapper needs an account id). #544
- Link guest enquiries to an account when the visitor later signs up with the same email. #544
- Private-viewing booking slots. Figma lists the booking flow as not yet designed

### LAX Account
- APIs and an Account resource for email change, notification preferences, profile edit and account deletion, so those screens move out of Bid. #543
- Address book and phone book (Figma `867:16367`). #556
- Language row once Account has locale support, and a theme preference shared across LAX origins. #543
- Component tests for the banner and pages, and Playwright coverage with a seeded session. #543

### Infrastructure and admin
- Wire `REDIS_URL` for deployed shop-api so enquiry rate limits are shared across instances. #544
- Shop Admin editing screens for the editorial joins (exhibition and story works and artists, with ordering) and the new content fields. #535, #549
- Remove the unused `--shell-gutter-*` variables in Bid and `--shop-header-inline` in Shop. #534

### Header and footer
- Figma footer items without routes: Our history, Careers, Press, Sitemap, Bidding policy. #537
- Home: horizontal stacked-story card, and CMS-driven LAX.bid and LAX.shop promo imagery. #541
- Press row date alignment: Figma right-aligns the date; the shared list row shows it as a meta line under the title. #552

## States

| State | Implementation |
| --- | --- |
| Loading | Route `loading.tsx` on list routes only (skeletons with fixed aspect ratios). Slug routes have none, so a missing record answers a real 404. Routes that change their own query string have none either (decision 9) |
| Empty | `ArtStatusState` (catalogue, search, favourites) and `ArtAccountListStateView` (account lists). Figma adds "You might like" on empty favourites and "Create alert" on search; neither is built |
| Error / unavailable | Composer `unavailable` results render `ArtStatusState`; per-section degradation on home and artist pages; `app/error.tsx`, `app/not-found.tsx`. Figma draws none, so the code's behaviour stays |
| Signed out | Heart routes to `/login?returnTo=…`. Enquiries work as a guest (decision 6); availability alerts need sign-in |
| Past exhibition | Built: "Closed" eyebrow and plain CTA band (`737:20593`) |
| Incomplete profile | Built: inverse banner for an unverified email or missing phone (`930:14088`) |

## Verification

- Unit: `pnpm --filter @auction/art test`, plus each shared package's tests for new primitives.
- Browser: `apps/art/e2e/` journeys at 1440 and 375, `@a11y` axe on `#main-content`, viewport overflow audit at 375 / 1024 / 1440. CI: `.github/workflows/art-e2e-pr.yml`. Local: `scripts/local/start-shop-stack.sh`, then `PLAYWRIGHT_E2E=1 pnpm --filter @auction/art test:e2e`.
- Guardrails: `scripts/check-ui-guardrails.mjs`, `verify-art-theme`, `verify-shop-theme`, `verify-account-theme`, `pnpm ci:shop-architecture`, light and dark theme check.
