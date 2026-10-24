import { cache } from "react";
import { getLaxAccountContainer } from "../container";
import {
  type SellerAccess,
  type SellingTool,
  UNKNOWN_SELLER_ACCESS,
  opensSellingTool,
  sellerAccessFromRead,
} from "../domain/selling/selling-access";
import type { SessionHandle } from "../ports/portfolio-gateway";
import { loadAccountSessionHandle } from "./load-account-record";

/** An answer is kept this long per person, so the menu does not ask Shop on every page. */
const ACCESS_TTL_MS = 60_000;
/** A failed lookup is retried sooner, so a seller's menu comes back quickly after an outage. */
const FAILED_ACCESS_TTL_MS = 15_000;
/** The menu waits no longer than this for Shop; past it the Selling entry is left out. */
const MENU_DEADLINE_MS = 1_500;
const MAX_CACHED_PEOPLE = 5_000;

const accessCache = new Map<string, { access: SellerAccess; expiresAtMs: number }>();

function remember(subject: string, access: SellerAccess): void {
  if (accessCache.size >= MAX_CACHED_PEOPLE) {
    const oldest = accessCache.keys().next().value;
    if (oldest !== undefined) accessCache.delete(oldest);
  }
  const failed = Object.values(access).includes("unknown");
  accessCache.set(subject, {
    access,
    expiresAtMs: Date.now() + (failed ? FAILED_ACCESS_TTL_MS : ACCESS_TTL_MS),
  });
}

/** The person's seller roles, from Shop's record of them, cached briefly per person. */
export async function readSellerAccess(
  handle: SessionHandle,
  deadlineMs?: number,
): Promise<SellerAccess> {
  const subject = handle.record.subject;
  const cached = accessCache.get(subject);
  if (cached && cached.expiresAtMs > Date.now()) return cached.access;
  const lookup = getLaxAccountContainer()
    .selling.readAccess(handle)
    .then((read) => {
      const access = sellerAccessFromRead(read);
      remember(subject, access);
      return access;
    });
  if (deadlineMs === undefined) return lookup;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<SellerAccess>((resolve) => {
    timer = setTimeout(() => resolve(UNKNOWN_SELLER_ACCESS), deadlineMs);
  });
  return Promise.race([lookup, late]).finally(() => clearTimeout(timer));
}

/** Drops the cached roles after a change that can grant one, such as a first sale request. */
export function forgetSellerAccess(subject: string): void {
  accessCache.delete(subject);
}

const loadHandle = cache(loadAccountSessionHandle);

/**
 * The roles the menu is built from: null when nobody is signed in or the session store is down.
 * Never throws and never waits long, because every page's shell asks for it.
 */
export const loadMenuSellerAccess = cache(async (): Promise<SellerAccess | null> => {
  try {
    const handle = await loadHandle();
    return handle ? await readSellerAccess(handle, MENU_DEADLINE_MS) : null;
  } catch (error) {
    console.warn("account_seller_access_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
});

export type SellingPageContext =
  | { status: "ok"; handle: SessionHandle; access: SellerAccess }
  | { status: "unsigned" }
  /** The session store could not be reached, so who is signed in is unknown. */
  | { status: "unavailable" }
  /** The person definitely does not hold the role this page needs. */
  | { status: "forbidden" };

/** Who is signed in and whether they may open a Selling page, read once per request. */
export const loadSellingPage = cache(async (tool: SellingTool): Promise<SellingPageContext> => {
  let handle: SessionHandle | null;
  try {
    handle = await loadHandle();
  } catch (error) {
    console.error("account_selling_session_failed", error);
    return { status: "unavailable" };
  }
  if (!handle) return { status: "unsigned" };
  const access = await readSellerAccess(handle);
  if (!opensSellingTool(access, tool)) return { status: "forbidden" };
  return { status: "ok", handle, access };
});

/** The signed-in person for the Selling entry point, with their roles. */
export const loadSellingEntry = cache(
  async (): Promise<
    { status: "ok"; access: SellerAccess } | { status: "unsigned" } | { status: "unavailable" }
  > => {
    let handle: SessionHandle | null;
    try {
      handle = await loadHandle();
    } catch (error) {
      console.error("account_selling_session_failed", error);
      return { status: "unavailable" };
    }
    if (!handle) return { status: "unsigned" };
    return { status: "ok", access: await readSellerAccess(handle) };
  },
);
