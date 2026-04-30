# @auction/ui

Shared UI primitives for Auction apps. This package is the **canonical shadcn UI registry** (style: `new-york`, `baseColor: neutral`, `cssVariables: true`, icons: `lucide-react`).

## Adding or updating shadcn components

Run commands from **`packages/ui/`** (not from `apps/web`). The CLI reads [`components.json`](./components.json), which points Tailwind/CSS at [`../../apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) so design tokens stay in one place.

```bash
cd packages/ui
pnpm dlx shadcn@latest add <component-name>
```

Examples:

```bash
pnpm dlx shadcn@latest add badge
pnpm dlx shadcn@latest add progress avatar popover
```

### After adding a component

1. **Exports**: Add the component to [`src/index.ts`](./src/index.ts) and to the `"exports"` field in [`package.json`](./package.json) (mirroring existing entries like `./components/button`).
2. **Build**: `pnpm --filter @auction/ui build`
3. **CSS variables**: If the new component uses shadcn default variables (`--background`, `--primary`, etc.), ensure they are aliased in `apps/web/src/app/globals.css` to the app’s `--surface` / `--on-surface` / brand tokens (see the “shadcn variable bridge” block in that file).

### Path aliases

`components.json` maps `utils` → `@/lib/utils` and `ui` → `@/components/ui`, which resolve via `tsconfig.json` (`@/*` → `./src/*`). Generated files land in **`src/components/ui/`**.

## Consumers

Import from `@auction/ui` or subpaths such as `@auction/ui/components/button`. The web app lists `@auction/ui` in `transpilePackages` in `next.config.ts`.
