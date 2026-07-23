/** Generic admin list filter adapter — feature modules implement; shared shell depends on this contract. */
export type AdminFilterAdapter<D> = {
  /** Hydrate draft from current URL + preserved lens/context params. */
  parse: (searchParams: URLSearchParams, preserved: AdminFilterPreserved) => D;
  /** Defaults when Reset is pressed (may respect active lens). */
  defaults: (preserved: AdminFilterPreserved) => D;
  /** Build navigation target for Apply (must reset offset). */
  buildHref: (
    pathname: string,
    current: URLSearchParams,
    draft: D,
    preserved: AdminFilterPreserved,
  ) => string;
  isDirty: (draft: D, applied: D) => boolean;
};

export type AdminFilterPreserved = Readonly<Record<string, string | undefined>>;
