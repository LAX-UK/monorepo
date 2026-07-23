export type FieldVariant = "boxed" | "underline";

export const fieldVariantBoxed =
  "rounded-md border border-outline-variant/25 bg-surface-container-lowest shadow-sm";

export const fieldVariantUnderline =
  "rounded-none border-0 border-b border-outline-variant/40 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary";

export function fieldVariantClasses(variant: FieldVariant | undefined): string {
  return variant === "underline" ? fieldVariantUnderline : fieldVariantBoxed;
}
