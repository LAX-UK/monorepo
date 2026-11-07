/** The most lots one payment covers; the API enforces the same limit. */
export const PAY_MAX_LOTS = 20;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the `lots` part of a Pay link holds. */
export type PayLots =
  | { kind: "none" }
  /** Something was given but none of it is a lot id. */
  | { kind: "invalid" }
  /** More lots than one payment covers. */
  | { kind: "too_many" }
  | { kind: "lots"; ids: string[] };

/** Reads `?lots=a,b,c`: each valid id once, in the order given. */
export function parsePayLots(raw: string | string[] | undefined): PayLots {
  const text = (Array.isArray(raw) ? raw.join(",") : (raw ?? "")).trim();
  if (text === "") return { kind: "none" };
  const ids = [
    ...new Set(
      text
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter((part) => UUID.test(part)),
    ),
  ];
  if (ids.length === 0) return { kind: "invalid" };
  return ids.length > PAY_MAX_LOTS ? { kind: "too_many" } : { kind: "lots", ids };
}
