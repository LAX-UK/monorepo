import { frameSwatchColour } from "@/server/domain/framing-catalogue.vm";
import type { FramingFrame } from "@auction/shop-domain";

/** The colour of a frame finish, a small chip beside an option's name. Decorative: the name says it. */
export function FrameSwatch({ frame }: { frame: FramingFrame }) {
  return (
    <span
      aria-hidden
      className="mr-2.5 inline-block size-4 rounded-staff-xs align-[-3px] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]"
      style={{ backgroundColor: frameSwatchColour(frame) }}
    />
  );
}
