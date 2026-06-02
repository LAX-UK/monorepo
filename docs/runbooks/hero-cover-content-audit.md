# Home hero cover — content audit checklist

Use this when a sale appears on the home hero rotator and edge decorations (polaroids, props) look clipped on large laptops.

## Cover image slots (`sale.coverImages`)

| Index | Role | Minimum size | Aspect |
|-------|------|--------------|--------|
| `[0]` | Desktop hero master (required) | 2560×900 | ≈ 21∶9 |
| `[1]` | Mobile portrait crop (optional) | 1080×1350 or 1080×1920 | 4∶5 or 9∶16 |
| `[2]` | Desktop xl crop (optional) | 2560×900 or 1920×1080 | Wide landscape tuned for 1280px+ |

Upload order in admin **Cover images** matches index order (first upload = `[0]`).

## Safe zone (desktop master)

- Keep subject, logos, and props inside the **center 70%** of the frame.
- Avoid critical content within **15%** of the left or right edge.
- CTAs and headlines are rendered in overlay copy — they are not part of the bitmap; design the photo so the lower-left quadrant stays readable.

## Audit steps

1. Open the sale in admin → confirm `[0]` is a wide master, not a cropped phone export.
2. On a 1920×1080 viewport, load `/` and check whether edge props are clipped.
3. If clipped:
   - **Preferred:** Re-export `[0]` with props moved inward (safe zone).
   - **Alternative:** Upload `[2]` as an xl-specific crop (served at `min-width: 1280px`).
   - **Alternative:** Upload `[1]` for phone-only art direction if mobile is the problem.
4. After desktop height cap (Tier B), xl laptops crop **sides less** — re-check before adding `[2]`.

## When not to add extra crops

- Subject is centered and no edge decorations → `[0]` only is fine.
- Letterboxing is not used on marketing heroes; do not upload square masters expecting full visibility.

See also [`docs/marketing-design-language.md`](../marketing-design-language.md) — Home hero cover uploads.
