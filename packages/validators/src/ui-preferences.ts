import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);

export type ThemePreference = z.infer<typeof themeSchema>;

export const DEFAULT_THEME_PREFERENCE = "system" as const satisfies ThemePreference;

/** Stored default for catalogue layout; `auto` = follow per-route cookie / fallback. */
export const layoutViewDefaultSchema = z.enum(["grid", "card", "list", "auto"]);

export type LayoutViewDefault = z.infer<typeof layoutViewDefaultSchema>;

/** Active layout on a screen (no `auto`). */
export const layoutViewSchema = z.enum(["grid", "card", "list"]);

export type LayoutView = z.infer<typeof layoutViewSchema>;

export const densitySchema = z.enum(["comfortable", "compact"]);

export type DensityPreference = z.infer<typeof densitySchema>;

/** PATCH body: all keys optional; at least one must be present. */
export const uiPreferencePatchSchema = z
  .object({
    theme: themeSchema.optional(),
    viewLotsDefault: layoutViewDefaultSchema.optional(),
    viewArtistsDefault: layoutViewDefaultSchema.optional(),
    viewSalesDefault: layoutViewDefaultSchema.optional(),
    density: densitySchema.optional(),
    viewSync: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    const keys = Object.keys(val).filter((k) => val[k as keyof typeof val] !== undefined);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one preference field is required",
      });
    }
  });

export type UiPreferencePatch = z.infer<typeof uiPreferencePatchSchema>;
