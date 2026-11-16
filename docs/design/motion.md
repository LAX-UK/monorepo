# LAX motion system (approved design)

All LAX products: LAX Bid, LAX Shop, lax.art, LAX Account, LAX Admin, Bid admin. Approved 15 Nov 2026 as recommended (MO1–MO15), open questions on their defaults (Q1–Q5).

## Principles
- Quick: every press answers within 100 ms. Leaving is always faster than arriving. No bounce or spring.
- Quiet: motion explains what happened. Only loaders and the live dot loop. Staff tools move less.
- One family: one token set in the shared LAX system; each product keeps its own accent.
- Free: CSS only. 0 KB of new JavaScript on any route. Route JS budgets/baselines are never raised. Lenis smooth scrolling is never touched (config lerp 0.1, smoothWheel, syncTouch false, anchors as today).
- Compositor only: animate transform and opacity (and clip-path for existing reveals). Never `transition: all`; no new animation of width, height, top, left, margin, box-shadow, filter or backdrop-filter.
- Nothing hidden at rest: server HTML and first paint show all indexable content. Hover never hides facts.

## Tokens (MO1)
Defined once in `packages/branding/public/lax-system.css`; staff values under the staff kit scope (`packages/staff-ui`). Existing `--motion-*` names in Bid, Shop and lax.art become aliases of these (no visible change).

| Token | Public | Staff | Use |
|---|---|---|---|
| `--lax-motion-press` | 100ms | 0ms | button/card press |
| `--lax-motion-hover` | 150ms | 100ms | colour, underline, border, background on hover/focus |
| `--lax-motion-enter` / `--lax-motion-exit` | 200ms / 140ms | 150ms / 100ms | menus, popovers, tooltips, toasts, tab content |
| `--lax-motion-fade` | 120ms | 100ms | tooltips; the fade under reduced motion |
| `--lax-motion-panel` / `--lax-motion-panel-exit` | 260ms / 180ms | 200ms / 150ms | dialogs, sheets, drawers, phone menu |
| `--lax-motion-page` | 140 out / 200 in | 100 out / 150 in | page cross-fade (later, MO5) |
| `--lax-motion-morph` | 360ms | n/a | artwork image card → page |
| `--lax-motion-media` | 700ms | n/a | slow card image zoom |
| `--lax-ease-out` | cubic-bezier(0.2, 0, 0, 1) | same | arriving, hover |
| `--lax-ease-in` | cubic-bezier(0.3, 0, 1, 1) | same | leaving |
| `--lax-ease-emphasize` | cubic-bezier(0.16, 1, 0.3, 1) | same | dialogs, image morph |

Distances: card lift 1px, menu 4px, dialog 8px, press scale 0.98, image zoom 1.02. Staff: no lift, no press scale, no zoom, no slide on menus.

## What moves
- Links/text buttons: underline + colour, hover token, ease-out. Staff 100ms. Reduced: instant.
- Buttons: hover colour; press darker + scale 0.98 for 100ms (public + Account, MO10). Staff colour only.
- Focus ring: never animated.
- Cards (MO9): image zoom 1.02 over 700ms, frame lift 1px over 300ms, title underline, only under `@media (hover: hover) and (pointer: fine)`. Bid lot tile 1.05 and sale card 1.03 come down to 1.02. Shop's 4px print lift stays, timed with tokens. Staff: row tint only.
- Page change now (MO4, MO7): no new whole-page animation on Next 15. Limit the light/dark circle wipe (900ms, `packages/marketing-ui/src/marketing-header.css`) to the theme switch only, so the Bid lot-image morph (360ms) and the admin cross-fade (staff timing) look as intended. Transition layer gets `pointer-events: none`; skip transitions under reduced motion.
- Page change later (MO5): React `<ViewTransition>` after a Next 16.3+ upgrade only; ships only with zero route JS growth. MO6: no cross-document view transitions.
- Menus, dropdowns, popovers, select, hover card: fade + scale from 0.97, 4px from trigger, enter 200 / exit 140. Staff fade only 150/100. Reduced: fade only 120ms. Radix Select unmounts at once on close (it has no presence layer), so Select animates on entry only; its exit is instant.
- Tooltips: 400ms open delay (`delayDuration={400}` on every `TooltipProvider`, written in place: a delay rather than a duration, so not a token, and a shared constant module would be copied into every chunk that renders a button), 120ms fade, instant between tooltips.
- Dialogs: scrim fades; panel rises 8px from 0.98, 260 in / 180 out, emphasize ease. Staff fade 200/150. Reduced: fade 120ms (`--lax-motion-fade`, within the ≤150ms ceiling).
- Sheets/drawers/phone menu: slide from edge 260/180 (keep vaul drag on phone bottom sheet). Staff 200/150. Reduced: fade only, 120ms (`--lax-motion-fade`, within the ≤150ms ceiling).
- Toasts (Sonner): rise 8px + fade, 200 in / 140 out, via Sonner CSS variables. Only the front toast's own exit is changed; toasts behind it and swiped toasts keep Sonner's positions.
- Tabs: content fades 150ms; underline moves instantly.
- Lists/tables: no animation on load/sort/filter. MO11: remove admin table row stagger; keep the returned-row tint.
- Images: hatched placeholder, then 200ms fade only for below-the-fold (`loading="lazy"`) images. First-screen images appear at once (no fade, protects LCP).
- Skeletons (MO12): one shared skeleton shaped like its page; fades in only after 150ms; then opacity pulse every 1.6s (opacity only, no background-position shimmer). Static under reduced motion. Spinners only inside buttons, keeping the label. No page-level spinners.
- Scroll reveals, cover settle, count-up: unchanged.
- Live dot / countdown: unchanged; countdown digits never animate.

## Implementation (MO8)
Write ~10 small keyframes in the shared kit (`packages/ui`) driven by the components' existing `data-state` open/closed attributes, using the tokens. Remove the dead `animate-in`/`fade-in`/`zoom-in-95` classes (tw-animate-css is not installed and will not be). Use `@starting-style` + `transition-behavior: allow-discrete` where elements enter from `display:none`. Menus, dialogs, sheets, tooltips and toasts render at the end of `<body>`, outside the staff shell, so they take the staff timings from a page scope in CSS, `:root:has([data-lax-density="staff"])`, which the staff shell sets once; no overlay reads the density in JavaScript, and the overlay motion adds no route JavaScript. Limitation: the scope is the page, not the region, so a layer opened from a client-density region on a staff page (today only the admin kit reference, `sheet-frame.tsx`) also takes staff timings; the kit page's "client" column does not show client motion. A closing layer gets `pointer-events: none` for its exit, so it takes no clicks, but it stays in the accessibility tree until it unmounts.

## Reduced motion (MO13)
Under `prefers-reduced-motion: reduce` or Bid's in-app motion switch: public products keep fades ≤150ms and remove all movement, zoom and loops; staff tools and LAX Account go fully instant. Bid's `force-allow` keeps motion on over the OS setting. Lenis follows today's rule unchanged.

Two existing rules sit above the kit's fades. Sonner's own `prefers-reduced-motion` rule makes toasts instant under the OS setting (`transition: none !important`), so a toast fade shows only under Bid's `force-reduce`. In Bid, `apps/web/src/app/globals.css` forces every animation and transition to 0.01ms under both reduce paths, so overlays there are effectively instant; Shop and lax.art show the kit's 120ms fade.

## Clean-ups (MO15)
Fix the sign-in blink (layout hides server content then fades it back). Stop fading first-screen images on Shop. Start lax.art's home hero visible. Remove permanent `will-change` on reveals (only while running). Stop animating header `backdrop-filter`. Swap the hang's box-shadow hover for a fading pseudo-element layer. Replace all 11 `transition-all`.

## Proof for every motion PR (MO14)
- Route JS: no growth on any route (`scripts/check-route-js-budget.mjs`; never raise budgets/baselines; motion PRs must not use the 1 KB noise allowance).
- Lighthouse mobile (4x CPU, slow 4G), median of 5 runs, before and after deploy on test: Bid home, sales list, sale, lot; Shop home, print; lax.art home, artwork; Account overview. LCP not worse (within 100ms/5%), CLS ≤ 0.1 and not higher.
- INP: scripted menu open, dialog open, card press, page change paint within 200ms at 4x CPU slowdown; no new long frames > 50ms.
- Compositor-only lint: rejects `transition-all` and new keyframes on layout/paint properties; Chrome non-composited animation list must not grow.
- Reduced motion: screenshots + scripts with reduced motion on; no movement.
- SEO: server HTML text and `<a href>` list identical before/after; JS-off screenshot at rest equals JS-on; every card fact visible without hover; no `blocking="render"`; no Speculation Rules added.
- Looks: still screenshots at rest at 1440 and 375, light and dark, unchanged except moving states. Short recordings of moving states in the PR.
- Lenis config file not in any diff; wheel + anchor scrolling checked on Bid, Shop, lax.art.
- MO14 also adds a hand-started CI workflow running Lighthouse (mobile, 5 runs) against the test sites after deploy.

## Open questions (defaults apply)
- Q1 Lenis anchor offset (`--marketing-header-height` never set): leave as is.
- Q2 Next.js upgrade for page transitions: wait.
- Q3 lax.art keeps its slower editorial reveals and hero drift: yes.
- Q4 LAX Account gets public timings, instant under reduced motion: yes.
- Q5 Live saleroom / clerk console: no change beyond shared menus/dialogs.

## Build (8 PRs)
1. Tokens + motion check: tokens in lax-system.css and staff scope, `--motion-*` aliases, token drift test, Playwright motion check (layout shift, interaction timing, reduced motion, JS-off parity), compositor lint, docs (DESIGN_SYSTEM + staff standard CRF-14). No visible change.
2. Page changes on Bid: circle wipe theme-only; lot morph 360ms; admin cross-fade staff timing; pointer-events none on transition layer; skip under reduced motion.
3. Menus, dialogs, sheets, toasts: kit keyframes in packages/ui on data-state; staff timings via staff scope; Sonner timings from tokens; remove dead classes.
4. Hover and press: shared card hover (mouse only); Bid tiles to 1.02; Shop print lift on tokens; press scale public + Account; replace transition-all; header blur not animated; hang shadow as fading layer.
5. Loading: one skeleton, delayed fade-in + opacity pulse; Bid/Shop/lax.art loading screens; Bid home loading shaped like home; fixes lax.art frozen shimmer and reduced-motion pulse.
6. First screen: Shop first-screen images no fade; lax.art hero visible at start; sign-in blink fixed; will-change only while running.
7. Staff tools: remove row stagger; staff timings on tabs/panels in LAX Admin and Bid admin; staff e2e screenshots.
8. Later: page transitions after the Next upgrade (Q2).

Engineering bar for all PRs: SOLID and clean; tokens are the single source of truth (no literal durations/easings in components); shared behaviour lives in shared packages, products only apply accents; small focused PRs; tests that fail without the change; copy in copy files.
