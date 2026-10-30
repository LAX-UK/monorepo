"use client";

import { Button, type ButtonProps } from "@auction/ui/lax";
import { Download, MoreHorizontal, Plus } from "lucide-react";
import { FORCED, SheetSection, StateRow } from "./sheet-frame";

type Variant = NonNullable<ButtonProps["variant"]>;

/** Each variant's hover and pressed look, as its own state classes draw them. */
const VARIANT_STATES: ReadonlyArray<{
  variant: Variant;
  label: string;
  hover: string;
  pressed: string;
}> = [
  {
    variant: "primary",
    label: "Primary",
    hover: "bg-lax-ink-hover",
    pressed: "bg-lax-ink-pressed",
  },
  {
    variant: "secondary",
    label: "Secondary",
    hover: FORCED.overlayHover,
    pressed: FORCED.overlayPressed,
  },
  { variant: "ghost", label: "Ghost", hover: "bg-lax-hover", pressed: "bg-lax-pressed" },
  {
    variant: "danger-secondary",
    label: "Danger",
    hover: FORCED.overlayHover,
    pressed: FORCED.overlayPressed,
  },
];

export function SheetButtons() {
  return (
    <SheetSection
      id="buttons"
      title="Buttons"
      description="One primary per view, a flat ink fill. Secondary carries a hairline, ghost sits in toolbars and rows, and the red fill is kept for the final destructive confirm. A disabled button says why on hover and focus."
    >
      {() => (
        <>
          {VARIANT_STATES.map(({ variant, label, hover, pressed }) => (
            <StateRow key={variant} label={label}>
              <Button variant={variant}>Default</Button>
              <Button variant={variant} className={hover}>
                Hover
              </Button>
              <Button variant={variant} className={pressed}>
                Pressed
              </Button>
              <Button variant={variant} className={FORCED.focus}>
                Focus
              </Button>
              <Button variant={variant} loading>
                Saving
              </Button>
              <Button variant={variant} disabledReason="Set up payouts first">
                Disabled
              </Button>
            </StateRow>
          ))}
          <StateRow label="Confirm">
            <Button variant="danger">Remove Lena Fischer</Button>
          </StateRow>
          <StateRow label="Sizes">
            <Button variant="primary" size="sm">
              Small 32
            </Button>
            <Button variant="primary">Default 36</Button>
            <Button variant="primary" size="lg">
              Large 44
            </Button>
          </StateRow>
          <StateRow label="With icon">
            <Button variant="primary" icon={<Plus aria-hidden />}>
              New lot
            </Button>
            <Button icon={<Download aria-hidden />}>Export</Button>
            <Button variant="ghost" size="icon-md" aria-label="More actions">
              <MoreHorizontal aria-hidden />
            </Button>
          </StateRow>
        </>
      )}
    </SheetSection>
  );
}
