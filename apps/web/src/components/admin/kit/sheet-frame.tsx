"use client";

import { type LaxDensity, LaxDensityProvider, laxDensityAttributes } from "@auction/ui/lax";
import { type ReactNode, createContext, useContext } from "react";

/**
 * How the sheet draws an interaction state it cannot hold still (hover, focus, pressed): the same
 * utility the element's own state applies, so the picture matches the live element.
 */
export const FORCED = {
  focus: "outline-2 outline-offset-2 outline-lax-focus outline-solid",
  focusInset: "outline-2 -outline-offset-2 outline-lax-focus outline-solid",
  overlayHover: "lax-overlay-hover",
  overlayPressed: "lax-overlay-pressed",
} as const;

/** The densities the sheet shows: both on the staff page, one on a single-density review page. */
const SheetDensities = createContext<readonly LaxDensity[]>(["staff", "client"]);

export function SheetDensitiesProvider({
  densities,
  children,
}: {
  densities: readonly LaxDensity[];
  children: ReactNode;
}) {
  return <SheetDensities.Provider value={densities}>{children}</SheetDensities.Provider>;
}

const DENSITY_LABEL: Record<LaxDensity, string> = {
  staff: "Staff",
  client: "Client",
};

/** A region drawn at one density, with the provider portalled layers read. */
export function AtDensity({ density, children }: { density: LaxDensity; children: ReactNode }) {
  return (
    <LaxDensityProvider density={density}>
      <div {...laxDensityAttributes(density)} className="min-w-0">
        {children}
      </div>
    </LaxDensityProvider>
  );
}

/** One element of the sheet: a title, what it is for, then the same states at both densities. */
export function SheetSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  /** Renders the element's states for one density. */
  children: (density: LaxDensity) => ReactNode;
}) {
  const densities = useContext(SheetDensities);
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-staff-lg border border-staff-line bg-staff-surface"
    >
      <header className="border-b border-staff-line-subtle px-4 py-3 md:px-6 md:py-4">
        <h2 id={`${id}-title`} className="font-staff-display text-staff-lg font-semibold">
          {title}
        </h2>
        <p className="mt-1 max-w-[72ch] text-staff-sm text-staff-muted">{description}</p>
      </header>
      <div
        className={densities.length > 1 ? "grid grid-cols-1 xl:grid-cols-2" : "grid grid-cols-1"}
      >
        {densities.map((density) => (
          <div
            key={density}
            className="min-w-0 border-staff-line-subtle px-4 py-4 not-first:border-t md:px-6 md:py-5 xl:not-first:border-t-0 xl:not-first:border-l"
          >
            <p className="mb-3 text-staff-xs font-medium text-staff-muted">
              {DENSITY_LABEL[density]}
            </p>
            <AtDensity density={density}>{children(density)}</AtDensity>
          </div>
        ))}
      </div>
    </section>
  );
}

/** A labelled row of one state: the state's name on the left, the element on the right. */
export function StateRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 items-center gap-2 py-2 sm:grid-cols-[112px_minmax(0,1fr)] sm:gap-4">
      <span className="text-staff-xs font-medium text-staff-muted">{label}</span>
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
