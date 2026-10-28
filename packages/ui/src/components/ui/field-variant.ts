export type FieldVariant = "boxed" | "underline";

/**
 * Both variants draw their edge in `--color-input-border`, which every product maps to the shared
 * field edge (`--brand-field-edge`, 3:1 or more on every page and container surface).
 */
export const fieldVariantBoxed =
  "rounded-md border border-input-border bg-surface-container-lowest shadow-sm";

export const fieldVariantUnderline =
  "rounded-none border-0 border-b border-input-border bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

export function fieldVariantClasses(variant: FieldVariant | undefined): string {
  return variant === "underline" ? fieldVariantUnderline : fieldVariantBoxed;
}
