# Dark / light mode audit (triage)

Generated as part of the accent-brand + theme preference work. Use ripgrep locally to refresh matches:

```bash
rg -n "#[0-9a-fA-F]{6}|text-\\[#|bg-\\[#" apps/web/src packages/ui/src --glob "*.tsx"
rg -n "text-white|text-black|bg-white|bg-black" apps/web/src packages/ui/src --glob "*.tsx"
```

## Priority surfaces

1. Header / nav / footer — mostly token-driven; accent uses `accent-brand`.
2. Marketing home — hero, sections, cards; watch for hard-coded hex on cream/dark backgrounds.
3. Auth — ensure scrim + form tokens respect `html.dark`.
4. Dashboard — tables, cards, `AppShell`.
5. `@auction/ui` primitives — inputs, dialogs, focus rings.

## Follow-up

Each hit should be reviewed: either replace with semantic tokens (`text-on-surface`, `bg-surface`, `border-outline-variant`) or add an explicit `dark:` companion when marketing needs a one-off.

Emails (`packages/email`) stay light-only by design.
