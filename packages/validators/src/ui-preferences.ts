import { z } from "zod";

export const themeSchema = z.enum(["light", "dark", "system"]);

export type ThemePreference = z.infer<typeof themeSchema>;

export const uiPreferencePatchSchema = z.object({
  theme: themeSchema,
});

export type UiPreferencePatch = z.infer<typeof uiPreferencePatchSchema>;
