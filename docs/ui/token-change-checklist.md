# Token change checklist

Use this checklist whenever changing brand colors, typography, spacing, or motion tokens during a redesign.

## Must change together

| Surface | Path |
|---------|------|
| Web CSS tokens | `apps/web/src/app/globals.css`, `apps/web/src/styles/tokens-dark.css`, `apps/web/src/styles/tokens-motion.css` |
| Brand package | `packages/branding/src/brand-identity.ts`, `packages/branding/src/tokens.ts` |
| Event app mirror | `apps/event/public/brand-tokens.css` |
| Shared UI | `@auction/ui` semantic classes (consumers inherit via CSS variables) |

## Automated guards

Run after any token edit:

```bash
pnpm --filter @auction/branding test
pnpm lint:ui-guardrails
pnpm exec biome check apps/web/src/app/globals.css packages/branding
```

`packages/branding/tests/tokens.test.ts` and `token-drift.test.ts` assert alignment between brand identity, web globals, and event CSS.

## Manual verification

- [ ] Marketing pages (`/`, `/artists`, `/sales`, lot detail) — light and dark
- [ ] Admin catalog list + detail (sale, lot, submission)
- [ ] Dashboard buyer overview + settings
- [ ] Transactional email preview (uses `packages/branding` hex mirrors)
- [ ] Event microsite (`apps/event`) if public event pages are in scope

## Do not hardcode

Avoid new legacy hex or font stacks in component source. Use semantic Tailwind tokens (`text-on-surface`, `bg-surface-container-low`, etc.). Exceptions (charts, OG images, third-party embeds) must be documented inline.

## Visual regression

Before merging large visual diffs, refresh baselines on `main`:

```bash
pnpm ci:visual-baseline
```

Requires local stack (`docker compose up`, web on `:3000`, API on `:3001`). Commit updated snapshots under `apps/web/e2e/**/*-snapshots/`.
