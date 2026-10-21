# lax.art Figma inventory

Design source of truth: [LAX.art rebuild](https://www.figma.com/design/JvWqZrAeu8r8fs5EfjDlRc/LAX.art-rebuild), page `72:2` "UI - In Progress".

Figma decides **what** exists: screens, sections, content order, states. The shared system decides **how** it is built: `@auction/ui`, `@auction/marketing-ui`, `@auction/branding`, and the "Apple model" rule in [`docs/DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).

Audited 2026-10-21 against `main` @ `c1cd0efe2`. Status meanings:
- **Built**: matches Figma.
- **Partial**: route exists; the deltas column lists what differs.
- **Missing**: no route or section.

Code paths are relative to `apps/art/src/`.

**Theme contract.** Use semantic tokens from `app/base.css` only. `base.css` is the only Art stylesheet allowed raw hex; `verify-art-theme` (`scripts/ci/verify-art-theme.test.mjs`) enforces this. Light/dark preference persists via `ArtThemeInit` and `ArtThemeToggle`.

**Composition rule.** Controls come from `@auction/ui` and `@auction/marketing-ui`. `scripts/check-ui-guardrails.mjs` rejects raw controls in `apps/art/src`. A control that Figma needs and the packages lack is added to the shared package, with a test, and is never built locally. See the [gap list](#shared-primitive-gaps).

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

## Frame matrix

### Global chrome

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Navigation (desktop component set) | `521:7889` | header | Partial | See "Header gaps" below. |
| Footer (in every desktop frame) | `235:226` | footer | Partial | Figma columns are About us / Our services / Policies / Contact us; code has Explore / Discover / Account / LAX products / Legal (`lib/layout/art-footer.vm.ts:54-74`). Resolved by decision 4: Figma links inside the shared columns. Figma background is #F8F8F8. |
| Bottom Navigation Bar (mobile) | `546:9946` | bottom nav | Partial | Same tabs. Figma bar is a floating inset pill with a filled active pill; `MarketingBottomTabBar` is full width with a top border. Label is "Favorites" vs "Favourites". |
| Page title (mobile app bar) | `489:3970` | mobile pages | Missing | Back + title + share/overflow. Mobile uses the global header and drawer instead. |
| Page titel (component) | `875:19061` | all list and editorial pages | Missing | Default: centred 300px band with title, subtitle and chip. Variant2: 500px image with scrim. Code uses the left-aligned `ArtPageHeader` / `ArtEditorialHeader`. |

**Header gaps** (`components/header/art-header.client.tsx`):
- The utility row lacks LOG IN and ENQUIRE.
- Nav items have no mega-menus: Artist (list + hover image), Artworks (3 columns), Exhibitions (list).
- Search is an icon link (L140-150), not an inline field with a "Top searches" overlay (Variant5).
- Figma shows a bag icon that Art has no use for.
- Code has a theme toggle that Figma does not show.
- The "Mu Account" variant is a stale LAX.bid header, so there is no signed-in header spec.

### Home (`614:12594`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Home page v1 | `235:225` | `/` | Partial | Figma order: hero · What's on across LAX (1 feature + 3) · Curators picks (rail) · Featured Artists (portrait rail) · LAX.bid split promo · Featured Stories (1 + 2 stacked) · LAX.shop split promo · Guide split promo · Our galleries · "Take the conversation further" CTA. Code (`app/(home)/page.tsx`): hero · What's on (uniform grid) · Featured originals (grid, square media) · Stories · Artists (circles) · Collector guide (grid). Missing: promos, galleries, CTA, feature layouts, rails. |
| Home page v1 (alternate) | `285:2928` | `/` | Partial | As above, but the two promos are one cream band with LAX.bid + LAX.shop cards, and the CTA is midnight. |
| Versions | `614:12622` | `/` | Missing | 4 illustration treatments of the `285:2928` promo band. The imagery should come from the CMS. |
| Mobile app | `337:7878` | `/` (mobile) | Partial | Search pill + bell header, Private Sales band, Auctions Picks (live Bid lots), carousels with dots, Follow on artist cards. |
| Mobile app (viewport) | `396:11666` | `/` (mobile) | Partial | Same as `337:7878` but a different section order. |
| Mobile responsive (web app) | `314:4765` | `/` (mobile web) | Partial | Heart + menu header, 2×2 grids, "Next sale" line on the LAX.bid promo. |

### Search (`826:13529`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Search open (header) | `826:14147` | header overlay | Missing | Full-width input, X, "Top searches". |
| Search found | `826:14746` | `/search?q=` | Partial | Figma has a centred title, Filters, and tabs Available / Sold / Exhibitions / Articles with counts, plus "n results · Sorted by Relevance". Code has an in-page form and Artists + Artworks sections, with no tabs, sort or count. |
| Search not found | `826:15255` | `/search?q=` | Partial | "No available items" + "Create alert" (needs a backend). Code shows different copy and a "Browse all artworks" link. |
| Search empty (mobile) | `886:18755` | `/search` | Partial | Full-screen pill input, prompt, promo card. |
| Search, regular user (mobile) | `886:14042` | `/search` | Missing | Recent searches (removable) and recently viewed. |
| Search not found (mobile) | `895:18920` | `/search?q=` | Partial | As desktop. |

### Artworks catalogue (`614:11120`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| All artworks (grid) | `538:4885` | `/artworks` | Partial | Figma has no filter rail. It shows department tiles (Originals / Prints & Editions / Sculptures) and a toolbar of Filters + Medium/Rarity/Price dropdowns + view toggle. Cards are portrait with the heart inline beside the title, regular-weight title, and price and Enquire stacked. Code has a permanent rail at `lg`, count/sort/search in the toolbar, square media and an overlaid heart. |
| All artworks List | `881:21945` | `/artworks?view=list` | Partial | Large landscape media, a divider, a right column with price + heart + outline Enquire. Code uses a 96px square thumbnail and an underline Enquire. |
| Filters (drawer spec) | `541:6507` | `/artworks` | Partial | 600px right drawer with accordions and multi-select checkboxes: Department, Sort by date, Artist, Painting techniques, Availability, Framed; Cancel/Apply. Code facets are single-select pressed buttons that commit immediately. Technique, framed, department and oldest-sort have no data. |
| Drop Down | `543:6997` | `/artworks` | Missing | Toolbar facet popover with checkboxes + Cancel/Apply. |
| All artworks (drawer open) | `546:8592` | `/artworks` | Partial | Tiles here read Originals / Prints & Multiples / Watches / Jewellery (differs from `538:4885`). |
| All artworks (dropdown open) | `546:9125` | `/artworks` | Missing | As Drop Down. |
| Type of artworks | `587:9412` | `/paintings` `/prints` `/sculptures` | Partial | 500px image hero; no tiles; no Enquire on cards. Figma is department-based ("Originals"). |
| Artworks cards (mobile) | `546:9559` | `/artworks` | Partial | "Discover Lax" title; shortcut strip (Exhibitions, Artists, then types); "24 Available"; cards show title, heart and artist only. |
| Artworks list (mobile) | `905:22051` | `/artworks?view=list` | Partial | Thumbnail, title, artist and price; no heart or Enquire. |
| Bottom sheet (mobile filters) | `551:10071` / `561:6647` | `/artworks` | Partial | "Reset all" / "Filters" / close header; checkbox accordions; "Show results". Code puts a search field in the sheet. |

### Artwork detail (`614:12570`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Artwork page | `426:2581` | `/artworks/[slug]` | Partial | Category breadcrumb above an 800/520 split. **Left:** portrait gallery with thumbnails. **Right:** title + heart, artist, spec table (cm + in), certificate link, price, "Inquire to purchase", then outline View in room and Share buttons. **Below, left column:** About/Exhibition-history tabs, Details/Medium/Provenance accordions, then an artist block (avatar, Follow, bio, Read more). **Last:** "More in this collection" rail. Code is 50/50 with a square gallery, the spec as a meta string and tabs in the right column. Missing: artist block, View in room. |
| Artwork page (scrolled) | `433:4845` | `/artworks/[slug]` | Missing | Sticky info column; pinned breadcrumb. |
| Mobile app | `468:7996` / `468:8877` | `/artworks/[slug]` | Partial | App bar (back, title, •••), full-bleed carousel with vertical dots, accordions, About the Artist, rail, FAQ pills, floating Follow + Enquire bar. No price on mobile. |
| Menu / menu bottom sheet | `905:21131` / `905:21586` | `/artworks/[slug]` | Missing | "More options": Share, More from this category, Contact specialist. |
| FAQ bottom sheet | `905:21656` | `/artworks/[slug]` | Missing | Contextual FAQ answer sheet. |

### Enquiry (`614:12202`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Send enquiry (artwork) | `531:8496` | `/artworks/[slug]` sheet | Partial | Intro copy, an artwork summary row, editable underline Name / Email / Phone / Message, an "Enquire" button and a privacy note. Code requires sign-in and shows name and email read-only from the account. |
| Send enquiry (general) | `614:12257` | header ENQUIRE | Partial | Same as above without the artwork row. Code has `ArtGeneralEnquirySheet`, but no header entry point. |
| Inquire bottom sheet / focused | `531:9043` / `533:9469` | mobile sheet | Partial | Same content deltas as the artwork enquiry. |
| Validation error (mobile) | `606:10621` | mobile sheet | Partial | Email validation (the email field is read-only in code). |
| Enquiry sent (mobile) | `616:12737` | mobile sheet | Partial | Centred animated check ("Check anim" `619:12987`). Code shows a success `Alert`. |

### Artists (`614:12542`, plus `1057:18576` in Art hub)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| All Artists | `1057:18576` | `/artists` | Partial | Category tile rail, Type-of-art and Nationality dropdowns, A–Z (built), portrait cards with Follow. Code uses circular avatars without Follow. |
| Artist profile | `439:6125` | `/artists/[slug]` | Partial | Sections:<br>• full-bleed hero (name, nationality and dates, Follow, "Represented by LAX")<br>• sticky anchor tabs<br>• biography with Read more + portrait<br>• Featured Artworks<br>• Originals (cream band)<br>• Exhibitions<br>• Films & Stories<br>• "Selling a work by …?" Request estimate<br><br>Code has a 128px avatar, the bio, and one grid capped at 24. `heroUrl`, nationality and years exist in the contract but are unused. |
| Section (LAX.bid promo) | `459:7359` | `/artists/[slug]` | Missing | Image banner "Exceptional works … surface in auction" + Explore auctions. Shown only when Bid has lots by the artist. |
| Mobile (Artworks tab) | `500:3615` / `521:7418` | `/artists/[slug]` | Partial | Back/share over the image, Artworks/About tabs, count + filters + view toggle, floating Follow pill. |
| Mobile (About tab) | `511:6867` / `521:7686` | `/artists/[slug]` | Missing | Bio with Read more, Featured Exhibitions rail, Films & Stories. |

### Exhibitions (`614:11014`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Exhibitions | `561:7003` (dup `1066:15039`) | `/exhibitions` | Partial | Reveal split-slide hero with dots; Filters + Current/Upcoming/Past tabs; 3-column cards with heart, location and time. Code has an H1 + intro, a featured rail, a "Now on" label, no heart and no location. |
| Exhibition page (current) | `743:20964` | `/exhibitions/[slug]` | Partial | Media page-title hero; 3-column facts (location + map, viewing, contact person); overview (video, quote); Works grid + View more; Featured artists (bio, birth line); Installation views peek carousel; Press list; cream "Request a private viewing" band. |
| Exhibition page (closed) | `737:20593` | `/exhibitions/[slug]` | Missing | Past state: "CLOSED" eyebrow, white CTA band. |
| Exhibition page (scrolling) | `574:8039` | `/exhibitions/[slug]` | Missing | Sticky sub-nav with thumbnail, title, dates and scroll-spy tabs Overview / Artworks / Featured Artists. |
| Exhibition Overview (mobile) | `599:7263` | `/exhibitions/[slug]` | Partial | Tabs Overview / Artworks & Artist / Press; Read more; specialist card; "How to find us" map. |
| Artworks & Artists (mobile) | `601:7820` | `/exhibitions/[slug]` | Missing | Count + filters, 2-column works, artist list with bios. |
| Press (mobile) | `606:10398` | `/exhibitions/[slug]` | Missing | Press rows with an external-link button. |
| Collect (mobile) | `606:8465` | `/exhibitions` (mobile) | Partial | Mobile "Collect" hub with the Exhibitions tile selected; this is not an exhibition tab. |

### Art hub and stories (`635:13357`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Arthub | `980:26767` | `/art-hub` | Partial | Nine sections:<br>1. hero with quick links<br>2. "Happening now" peek carousel<br>3. stories mixed carousel<br>4. In the spotlight (artists)<br>5. podcast panel with audio player<br>6. films<br>7. Collecting 101 split panel<br>8. black Press list<br>9. LAX.shop / LAX.bid cross-sell<br><br>Code has only spotlight + stories grids. |
| All Stories | `1068:16594` | `/stories` (new) | Missing | Page title + chip; Filters + tabs Artist Stories & Films / LAX's Podcast / Press; cards with category and date; repeatable Conversation and split features; film card. |
| Artist Stories | `1068:17219` | `/stories?tab=…` | Missing | Reveal conversation carousel; 2×3 cards. |
| Podcast | `1068:17562` | `/stories?tab=podcast` | Missing | Latest-episode hero with audio player; episode cards. |
| Press tab (named "Podcast") | `1068:17901` | `/stories?tab=press` | Missing | 2×3 press cards. |
| Article | `687:17324` | `/stories/[slug]` | Partial | Hero with centred title and byline + date; wide and bleed captioned images; inline artwork pair with price; dynamic Related content (exhibition → LAX.bid → stories). Code caps every block at `max-w-3xl`, has no byline and no related content. |
| Latest Stories (mobile) | `716:19075` | `/stories` | Missing | App bar with filter; single-column cards. |
| Article (mobile) | `716:18901` | `/stories/[slug]` | Partial | Inline artwork carousel with dots; Related Exhibitions rail. |
| Loose section patterns | `1005:19903` `1010:20286` `992:14944` `995:15825` `1068:18293` `1068:18351` `1068:18188` `1068:17020` | hub and stories | Missing | Alternatives and repeatable blocks: exhibition feature, featured-artist split, film list, event feature, conversation, podcast hero, reveal slide, framed podcast. No editorial block type covers them. |

### Collect hub, guides, visit, how-to (`780:8898`, `816:10177`, `921:13108`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Hub card (component set) | `782:11358` | — | Missing | Variants: split, vertical, text, dark, overlay, mobile. Body copy and "Learn more →". |
| Collect hub | `782:11154` | `/collector-hub` | Partial | Page title band; a 2-column grid of 6 split cards (Private Sales, 101 Guides, Art Advisory, Private Viewings, Sell Through LAX, Services for Owners); "Get in touch" image banner. Code uses a 3-column image-top grid, and placements have no body or CTA label. |
| 101 Guide | `782:11834` | `/collector-hub/101-guide` | Partial | Image hero + "Collecting guide" chip; 3-column guide cards with "LAX GUIDE \| n MIN READ". |
| Guide detail (named "Collect hub") | `782:14430` | `/stories/[slug]` (kind `guide`) | Partial | Image hero; 860px column; numbered section headings; 660×560 image pair; 18/26 prose. |
| Guide reading state | `782:15111` | same | Missing | Sticky title bar: back-to-top thumbnail, Share, reading progress bar. |
| Collect hub (mobile) | `780:9171` | `/collector-hub` | Partial | App bar; stacked cards with ↗. |
| Guide (mobile) | `804:16104` | guide detail | Partial | Hero; image-pair carousel with dots. |
| Locations | `816:10184` | `/visit` | Partial | "LAX's Locations" title; intro; "Our galleries" 2-up cards (name, street, postcode, square media). Code has hours + "Plan your visit" + a private-viewing section that Figma lacks. |
| Location detail | `821:11603` | `/visit/[slug]` | Partial | Image hero; Jump-to bar; icon fact rows + static map + "View on Google Maps"; Current Exhibitions; Story; "You may also like". |
| Locations / detail (mobile) | `816:10442` / `816:10455` | `/visit`, `/visit/[slug]` | Partial | App bar; hairline fact rows; map. |
| How to buy | `921:13111` | `/how-to-buy` | Partial | 5 bordered step cards, each with FAQ links + "Visit our Help Centre". Code is a CMS body plus a buttons aside. |
| Help answer (named "How to buy") | `923:13696` | `/help/…` (new) | Missing | Search hero; breadcrumb; question + answer + "Contact our team"; related-questions sidebar. |

### Favourites and account (`866:11034`, `867:16339`)

| Figma frame | Node | Route | Status | Deltas |
| --- | --- | --- | --- | --- |
| Favorite Artworks empty | `867:15986` | `/account/favourites` | Partial | Centred title; Saves / Follows tabs; empty copy; "You might like" (no data source). Code stacks both lists in the account shell. |
| Favorite Artworks filled | `866:11652` | `/account/favourites` | Partial | Saved Artworks with meta and price; **Saved Exhibitions** (no backend). |
| Followed artists | `867:15613` | `/account/favourites?tab=follows` | Partial | Follow row (avatar, name, dates, Following button) + "Previewing 4 of n works". Code uses a portrait-name grid. |
| Saved Artworks / Followed Artists (mobile) | `912:22916` / `914:23516` | `/account/favourites` | Partial | Tabs; "Artists ⌄" type select; list rows with unfollow. |
| My account | `867:16367` | `/account` | Partial | Hero with monogram; tabs Manage Profile / Inquiries; Personal details with Verified pill; address management; phone book; promo cards. Code is a read-only `dl` with a 5-item side nav. |
| Enquiries | `871:17403` | `/account/enquiries` | Partial | One unified list with reference, type, status pill, thumbnail, latest reply and date. Code has two sections with title + "status · date". |
| Account (mobile) | `928:13358` / `933:13593` / `930:14088` | `/account` | Partial | Settings gear; Inquiries count + filters with Replied/Awaiting pills; "You're almost ready" banner. |
| Edit account / email / notifications / privacy / contact (mobile) | `950:13732` `950:14072` `956:14230` `956:14309` `956:14392` | `apps/account` | Missing | These edit flows live only in Bid today. Decision 7: build them in LAX Account; Art deep-links. |
| Settings (mobile) | `930:14289` / `930:15435` | `apps/account` | Missing | Preferences (language, theme, notifications), Support, Legal, Sign out. Decision 7. |
| Enquiry list item (component) | `872:17745` | — | Missing | Default / Artwork enquiry / mobile. |
| Heart (component) | `866:14253` | — | Partial | Bare 24px glyph, a 40px on-media variant, and a red saved state. `MarketingHeartToggle` is always a bordered 40px circle with an obsidian fill. |

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

Favorites and My account are on the not-yet-designed list but now have frames (above).

## Token deltas

Figma values come from `get_variable_defs`. Code values are from `packages/branding` and `app/base.css`.

| Area | Figma | Code | Note |
| --- | --- | --- | --- |
| Display face | DM Sans: SemiBold 60/1.2 page titles; Medium 40/48 section titles; 44 promo headlines | `BRAND_FONTS` is Montserrat / Outfit | Decision 1: Montserrat at Figma sizes |
| Body face | Montserrat | Montserrat | Match |
| Section title size | 40/48 | `--text-title-section` max 28px | — |
| Primary CTA | Midnight #081F5B (most frames); black on some | `--color-primary` / `--color-cta-bg` obsidian | Decision 2: obsidian stays (navy is Bid's) |
| Midnight scale | 700 #081F5B, 600 #394B7B, 200 #CED2DE, 100 #E6E9EE | Art maps midnight to link, ring, secondary and hero CTA | Decision 2: remove from Art; not added |
| Cream surface | Cream/100 #F1F0DF (some fills unbound at #F5F4E9) | `--brand-light-cream` #F2F1DF, no semantic surface alias | Add `surface-feature` |
| Inverse surface | Black sections (hub press, films) | none | Add `surface-inverse` |
| Saved heart | Red fill | none (`--color-live-red` is the closest) | Add `favorite` |
| Neutrals | 100 #F5F5F5, 300 #E1E1E1, 400 #CACACA, 500 #8E8E8E, 600 #4B4B4B, 700 #1F1F1F | Close but not equal; 400 and 500 missing | Align |
| Media radius | 0 (cards, images, hub cards) | `rounded-md` / `rounded-sm` / `rounded-lg` | — |
| Button / card radius | 6px / 8px | `--radius-md` / `--radius-lg` | Match |
| Button text | Mixed case, 16/24 and 14/20 Medium | Many variants uppercase-tracked | — |
| Gutters | 40px desktop, 16px mobile | `MARKETING_PAGE_GUTTER_X` `px-8 md:px-10 lg:px-14` (32 / 40 / 56px, shared) | Decision 3: shared token moves to 16 / 24 / 40 |
| Reading column | 860px, prose 18/26 | `max-w-3xl` (768px), prose 16px | — |
| Page background | ~#FAFAFA (unbound, unverified) | #FFFFFF | Confirm |

## Shared-primitive gaps

Each gap is added to the shared package with a unit test before Art consumes it. "Adopt" lists the other products that should move to it.

### `@auction/marketing-ui`

| Primitive | Figma use | Adopt |
| --- | --- | --- |
| `MarketingPageTitle` (`plain` \| `media`, eyebrow, subtitle, chip, byline) | Every list and editorial page | Shop, Bid |
| `MarketingMobileAppBar` (back, title, share/overflow) + action sheet | All mobile frames, artwork "More options" | Shop, Bid |
| `MarketingSubNav`: link, anchor and scroll-spy tabs; sticky; identity slot; optional reading progress. Promote Bid's local `marketing-underline-tabs` | Artist tabs, exhibition sticky bar, guide reading bar, favourites and account tabs, story tabs | Bid, Shop |
| `MarketingSplitFeature` (media side, `tone` cream / inverse / plain, eyebrow, quote / CTA / audio slots) | Bid and Shop promos, sell-estimate CTA, Collecting 101, conversations, event feature | Shop, Bid |
| `MarketingCtaBand` (`tone` cream / plain / image) | Home CTA, exhibition private viewing, hub "Get in touch", artist LAX.bid banner | Shop, Bid |
| `MarketingFeatureCard` (split, vertical, text, dark, overlay) | Collect hub cards | Shop, Bid |
| `MarketingEditorialCard` (move `ArtEditorialCard` here; adds meta row, heart, sizes) and feature layouts (1 + n, 1 + 2 stacked) | What's on, stories, guides, related content | Shop journal, Bid press |
| `MarketingEditorialListRow` (eyebrow, title, meta, index, duration, trailing arrow, inverse tone) | Press lists, film list | Bid press |
| `MarketingHorizontalRail` extensions: `peek`, mixed-size, `dots` controls | Happening now, installation views, mobile rails | Shop, Bid |
| `MarketingRevealCarousel` (split slide + dots) | Exhibitions hero, artist stories | Bid, Shop home |
| `MarketingAudioPlayer` | Podcast | — |
| `MarketingStickyActionBar` (generalises `StickyBidBar`) | Mobile artwork Follow + Enquire, artist Follow | Bid lot, Shop PDP |
| `MarketingHeaderSearch` (inline field, overlay, top and recent searches) and `MarketingHeaderMegaNav` featured-media panel (Art adopts MegaNav) | Header | Shop, Bid |
| `MarketingBottomTabBar` `floating` variant | Mobile nav | Bid (still local) |
| `MarketingFilterDropdown`, checkbox facet groups with draft/apply, a desktop drawer trigger on `MarketingListToolbar` | Catalogue, artists, exhibitions, search | Shop, Bid |
| `MarketingHeartToggle` `appearance` (bare / on-media), `size` (24 / 40), saved-colour token | Every card | Bid watch hearts |
| `MarketingCatalogListRow` large media + aside column | Artworks list view | Bid, Shop |
| `MarketingSpecList` | Artwork spec table | Bid lot, Shop PDP |
| `MarketingArtistSummary` (avatar, name, Follow, clamped bio) and `MarketingReadMore` | Artwork detail, artist bio, exhibition overview | Bid |
| `MarketingFollowRow` | Followed artists | Bid artist watch |
| `MarketingEnquiryListItem` (default / artwork / mobile) | Account enquiries | Shop account |
| `MarketingSuccessState` (animated check) and a `search-remove` status motif | Enquiry sent, search not found | Bid, Shop, Account |
| `MarketingContactFactList` (icon rows; replaces local `ArtVenueFacts`), `MarketingContactCard`, `MarketingStaticMap`, `MarketingInfoStrip` 3-column icon variant | Visit detail, exhibition facts and specialist | Bid venues |
| `MarketingStepCard`, `MarketingFaqLink`, FAQ pill + sheet | How to buy, help, artwork FAQs | Shop, Bid |
| `MarketingLinkList` | Hub hero quick links | — |
| `MarketingVenueCard` | Home galleries, `/visit` | Bid venues |
| Ecosystem cross-sell card (data from `@auction/lax-ecosystem`) | Home promo, hub footer | Shop, Bid |
| Recent searches and recently viewed (promote `apps/web` `recently-viewed-rail`) | Mobile search | Bid, Shop |

### `@auction/ui`

| Primitive | Figma use | Adopt |
| --- | --- | --- |
| `Button`: mixed-case arrow link, outline matching Figma (1px, 6px radius, 16/24). No midnight variant (colour rule). | CTAs, "Learn more →" | All |
| `ListRow` `href` / `asChild` | Settings and edit-account rows | LAX Account (replaces local `Card` / `Row` / `StatusPill`) |
| `Alert` inverse dismissible | "You're almost ready" | Account, Bid |
| `Avatar` monogram (bracket frame) | Account hero | Account, Shop |
| `Badge` chip link | "Collecting guide" tag, "Represented by LAX" | Shop, Bid |
| `Carousel` vertical dots and portrait aspect | Mobile artwork gallery | Bid, Shop |

### `@auction/branding`

Changes for this package:
- Add semantic `surface-feature` (cream), `surface-inverse` and `favorite` tokens.
- Align the neutral scale.
- Add a per-product accent token with `--color-product-accent` (colour rule).
- Change gutters to 16 / 24 / 40.

There is no display face and no midnight scale for Art.

## Data and contract gaps

These are not UI work; the sections that depend on them render only once the data exists, and are otherwise hidden.

| Need | Today | Blocks |
| --- | --- | --- |
| Editorial joins (exhibition↔artwork/artist, story↔artist/artwork/exhibition) | DB tables exist (`packages/db/src/schema/shop-editorial.ts`), not exposed by shop-api | Exhibition works and artists, artist exhibitions and stories, related content |
| Story `publishedAt`, author, read minutes, series/category, `podcast` kind, audio URL + duration, film duration, press publication | Only `kind` (article / film / press / guide); `publishedAt` stored but not returned | Stories index, tabs, cards, podcast, press rows |
| Exhibition status, venue on summary, contact person, sub-type | Not in contract | Cards, closed state, facts row |
| Placement slots (home promos, galleries, CTA; hub sections) + placement body / CTA label | 6 slots, headline only | Home, Art hub, Collect hub |
| Catalogue: department, technique, framed, multi-value filters, facet counts, oldest/relevance sort, private-sale flag | Object type and single-value params | Filters, departments, Private Sales |
| Artist: represented-by-LAX, original split, pagination | Not in contract | Artist profile |
| Favourites: exhibitions; richer saved-artwork and followed-artist rows | Artworks and artists only, thin rows | Favourites |
| Enquiries: unified list, reference, thumbnail, latest reply, general status | Two lists, no reply or status on general | Account enquiries |
| LAX.bid artist link + upcoming/past lots read port | No shop↔Bid artist mapping | Artist Bid promo, home Auctions Picks, related auctions |
| FAQ / help entity with categories and search | None | Help centre, artwork FAQs, how-to-buy links |
| Saved-search alerts, recommendations, recently viewed, private-viewing slots, view in room, guest enquiry | None | Respective features |

## States

| State | Implementation |
| --- | --- |
| Loading | Route `loading.tsx` on list routes only (skeletons with fixed aspect ratios); slug routes have none, so a missing record answers a real 404 |
| Empty | `ArtStatusState` (catalogue, search, favourites) and `ArtAccountListStateView` (account lists). Figma adds "You might like" on empty favourites and "Create alert" on search |
| Error / unavailable | Composer `unavailable` results render `ArtStatusState`; per-section degradation on home; `app/error.tsx`, `app/not-found.tsx`. Figma draws none, so the code's behaviour stays |
| Signed out | Heart routes to `/login?returnTo=…`. Enquiry becomes a guest form (decision 6) |
| Past exhibition | Figma `737:20593`; not built |
| Incomplete profile | Figma `930:14088`; not built |

## Verification

- Unit: `pnpm --filter @auction/art test`, plus each shared package's tests for new primitives.
- Browser: `apps/art/e2e/` journeys at 1440 and 375, `@a11y` axe on `#main-content`, viewport overflow audit at 375 / 1024 / 1440. CI: `.github/workflows/art-e2e-pr.yml`. Local: `scripts/local/start-shop-stack.sh`, then `PLAYWRIGHT_E2E=1 pnpm --filter @auction/art test:e2e`.
- Guardrails: `scripts/check-ui-guardrails.mjs`, `verify-art-theme`, `pnpm ci:shop-architecture`, light and dark theme check.
