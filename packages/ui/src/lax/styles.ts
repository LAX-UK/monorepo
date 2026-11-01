/**
 * Class lists shared by the LAX primitives. A plain module (no "use client"), so a server
 * component can use them as well as a client one.
 */

/** The tooltip surface: a small ink label, 12/16 at 500, raised over everything. */
export const tooltipClass =
  "flex items-center gap-2 rounded-lax-badge border-0 bg-lax-ink px-2 py-1 font-lax text-lax-12 font-medium text-lax-on-ink shadow-lax-md";

/**
 * How a read-only control draws its value: the field box without the control look, at the
 * foreground colour, so values read as content and not as disabled controls.
 */
export const readOnlyBox =
  "data-[readonly]:cursor-default data-[readonly]:border-lax-line! data-[readonly]:bg-transparent! data-[readonly]:text-lax-fg!";

/**
 * The field box shared by text inputs, the money input, pickers and selects: one border, one
 * radius, one hover, one focus ring and one error treatment, so every control in a form lines up.
 */
export const fieldBox = [
  "flex w-full min-w-0 items-center gap-2 rounded-lax-control border bg-lax-surface px-3",
  "font-lax text-lax-fg transition-[border-color,box-shadow] duration-150 ease-out",
  "border-lax-control-edge hover:border-lax-control-edge-hover",
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lax-focus",
  "has-[[aria-invalid=true]]:border-lax-danger",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:border-lax-line has-[:disabled]:bg-lax-sunken has-[:disabled]:text-lax-disabled-fg",
  "has-[input:read-only,textarea:read-only]:bg-lax-sunken",
  "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-lax-subtle",
].join(" ");

/**
 * A link in running text or on its own line: ink, underlined with a 4px offset, 14/20 at 500
 * (the interface step follows the density). Underlined at rest, so it never relies on colour
 * alone; the line gets heavier on hover. The target size comes from the row, not from padding.
 */
export const textLinkClass = [
  "inline-flex max-w-full items-center gap-1 rounded-lax-badge align-baseline",
  "font-lax text-lax-ui font-medium text-lax-fg",
  "underline decoration-1 underline-offset-4 hover:decoration-2",
  "lax-focus aria-disabled:pointer-events-none aria-disabled:text-lax-disabled-fg",
  "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
].join(" ");
