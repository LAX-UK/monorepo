import type { CSSProperties, ReactNode } from "react";
import type { HangLayout, HangSalonReason } from "./hang-layout.js";

const SALON_COPY: Record<HangSalonReason, { desktop: string; phone: string }> = {
  "missing-size": {
    desktop: "Sizes missing for some works, so they hang at equal height",
    phone: "Some sizes missing",
  },
  "wide-range": {
    desktop: "Sizes differ too much to show to scale, so they hang at equal height",
    phone: "Sizes differ too much",
  },
};

type MarketingHangFooterProps = {
  desktop: HangLayout;
  phone: HangLayout;
  /** Right-hand note on desktop. */
  note?: ReactNode;
};

/** The wall's key: a scale bar and "True relative scale", or the honest "Not to scale" mark. */
export function MarketingHangFooter({ desktop, phone, note }: MarketingHangFooterProps) {
  const copy = desktop.salonReason ? SALON_COPY[desktop.salonReason] : null;
  return (
    <div className="mt-5 flex items-center justify-between gap-6 font-body text-xs leading-4 text-on-surface-variant max-sm:mt-2.5">
      <span className="flex min-w-0 items-center gap-4">
        {desktop.mode === "salon" ? (
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className="block h-2.5 w-3.5 border border-dashed border-on-surface-variant"
            />
            Not to scale
          </span>
        ) : desktop.scaleBar && phone.scaleBar ? (
          <span
            role="img"
            aria-label={`Scale bar: ${desktop.scaleBar.cm} cm`}
            className="inline-flex shrink-0 flex-col gap-1"
            style={
              {
                "--bar-d": `${desktop.scaleBar.widthPx}px`,
                "--bar-m": `${phone.scaleBar.widthPx}px`,
              } as CSSProperties
            }
          >
            <span
              aria-hidden
              className="block h-1.5 w-[var(--bar-m)] border border-t-0 border-on-surface-variant sm:w-[var(--bar-d)]"
            />
            <span aria-hidden className="font-mono">
              <span className="sm:hidden">{phone.scaleBar.cm} cm</span>
              <span className="max-sm:hidden">{desktop.scaleBar.cm} cm</span>
            </span>
          </span>
        ) : null}
        <span className="truncate">
          {copy ? (
            <>
              <span className="sm:hidden">{copy.phone}</span>
              <span className="max-sm:hidden">{copy.desktop}</span>
            </>
          ) : (
            "True relative scale"
          )}
        </span>
      </span>
      {note ? <span className="shrink-0 max-sm:hidden">{note}</span> : null}
    </div>
  );
}
