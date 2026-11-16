import { CLERK_COMMAND_COPY } from "@/features/saleroom/lib/clerk-command-copy";
import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import type { ActionResult } from "@/lib/forms/form-result";

/**
 * The clerk console's saleroom commands, sent from the browser to the API through the same-origin
 * Bid BFF (`/api/bff/...`), like the bidder side.
 *
 * They used to be Next.js server actions. A server action is addressed by an id that belongs to
 * one build, so a console opened before a deploy posts an id the new build does not know: Next
 * answers 404, throws `UnrecognizedActionError`, and the console fell into its error boundary
 * mid-sale. A BFF path is the same on every build, so a console left open across a deploy keeps
 * working. The API still checks the clerk's capability on every command.
 *
 * Nothing here retries. A command whose response was lost is not sent again, so a lot can never
 * be hammered twice; the console re-reads the room from the server instead. Hammer and pass name
 * the lot the clerk saw, and the API refuses them (`lot_not_on_block`) once the room has moved on.
 */

export const CLERK_COMMAND_UNREACHABLE = CLERK_COMMAND_COPY.unreachable;
export const CLERK_COMMAND_SESSION_EXPIRED = CLERK_COMMAND_COPY.sessionExpired;
/** The API's answer to a hammer or pass for a lot that is no longer on the block. */
export const LOT_NOT_ON_BLOCK = "lot_not_on_block";

export type ClerkCommandFetch = (input: string, init: RequestInit) => Promise<Response>;

let commandFetch: ClerkCommandFetch = (input, init) => browserFetch(input, init);

/** Test seam: swaps the transport for the duration of a test. */
export function setClerkCommandFetchForTests(next: ClerkCommandFetch | null): void {
  commandFetch = next ?? ((input, init) => browserFetch(input, init));
}

function saleroomPath(saleId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/saleroom/${suffix}`;
}

function telephoneBookingPath(saleId: string, bookingId: string, suffix: string): string {
  return `/admin/sales/${encodeURIComponent(saleId)}/telephone-bookings/${encodeURIComponent(bookingId)}/${suffix}`;
}

/** What the API answers: `{ data }` on success, `{ error, code }` on a refusal. */
type ApiBody = { data?: unknown; error?: unknown; code?: unknown } | null;

async function sendClerkCommand<T = void>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; body?: Record<string, unknown> },
  fallback: string,
  readData?: (body: ApiBody) => T | undefined,
): Promise<ActionResult<T>> {
  let res: Response;
  try {
    res = await commandFetch(`${browserApiBase()}${path}`, {
      method: init.method ?? "POST",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    return { ok: false, error: CLERK_COMMAND_UNREACHABLE };
  }
  // A body that is not JSON (an HTML error page) reads as none.
  const body: ApiBody = await res.json().catch(() => null);
  if (!res.ok) {
    // Built here rather than with `actionFailure` or `readApiError`: the shared helpers would then
    // ship in two page chunks and stop being inlined into either.
    const code = typeof body?.code === "string" ? body.code : undefined;
    // An absent code stays `undefined` rather than being spread out: fewer bytes, same reading.
    return {
      ok: false,
      error:
        res.status === 401 || code === "session_required"
          ? CLERK_COMMAND_SESSION_EXPIRED
          : typeof body?.error === "string"
            ? body.error
            : fallback,
      status: res.status,
      errorCode: code,
    } as ActionResult<T>;
  }
  const data = readData?.(body);
  return data === undefined ? { ok: true } : { ok: true, data };
}

function readCreatedId(body: ApiBody): { bidId: string } | undefined {
  const id = (body?.data as { id?: unknown } | undefined)?.id;
  return typeof id === "string" ? { bidId: id } : undefined;
}

export function clerkGoLive({ saleId }: { saleId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "go-live"), {}, "Go live failed");
}

export function clerkPause({ saleId }: { saleId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "pause"), {}, "Pause failed");
}

export function clerkResume({ saleId }: { saleId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "resume"), {}, "Resume failed");
}

export function clerkClose({ saleId }: { saleId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "close"), {}, "Close failed");
}

export function clerkAdvance({ saleId, lotId }: { saleId: string; lotId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "advance"), { body: { lotId } }, "Advance failed");
}

export function clerkHammer({ saleId, lotId }: { saleId: string; lotId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "hammer"), { body: { lotId } }, "Hammer failed");
}

export function clerkNoSale({ saleId, lotId }: { saleId: string; lotId: string }) {
  return sendClerkCommand(saleroomPath(saleId, "no-sale"), { body: { lotId } }, "No sale failed");
}

export type ClerkLotSnapshot = {
  lotId: string;
  currentPrice: string;
  reservePrice: string | null;
};

/** The lot's price and reserve as the server holds them now. */
export function clerkLotSnapshot({ saleId, lotId }: { saleId: string; lotId: string }) {
  return sendClerkCommand(
    saleroomPath(saleId, `lots/${encodeURIComponent(lotId)}`),
    { method: "GET" },
    "Lot did not load",
    (body) => body?.data as ClerkLotSnapshot | undefined,
  );
}

export function clerkDisplayApprove({ saleId, userCode }: { saleId: string; userCode: string }) {
  return sendClerkCommand(
    saleroomPath(saleId, "display/approve"),
    { body: { userCode: userCode.trim().toUpperCase() } },
    "Display approve failed",
  );
}

export function clerkDisplayRevoke({ saleId, pairingId }: { saleId: string; pairingId: string }) {
  return sendClerkCommand(
    saleroomPath(saleId, "display/revoke"),
    { body: { pairingId } },
    "Revoke failed",
  );
}

export function clerkDisplayOverlay({
  saleId,
  kind,
  message,
}: {
  saleId: string;
  kind: "fair_warning" | "announcement";
  message?: string;
}) {
  const trimmed = message?.trim();
  return sendClerkCommand(
    saleroomPath(saleId, "display/overlay"),
    { body: { kind, ...(trimmed ? { message: trimmed } : {}) } },
    "Overlay failed",
  );
}

export function clerkDisplayClearOverlay({ saleId }: { saleId: string }) {
  return sendClerkCommand(
    saleroomPath(saleId, "display/overlay"),
    { method: "DELETE" },
    "Clear overlay failed",
  );
}

export function clerkPlacePaddleBid(input: {
  saleId: string;
  lotId: string;
  paddleNumber: number;
  amount: number;
}) {
  return sendClerkCommand(
    "/admin/saleroom/paddle-bids",
    {
      body: {
        saleId: input.saleId,
        lotId: input.lotId,
        paddleNumber: input.paddleNumber,
        amount: input.amount,
      },
    },
    "Paddle bid failed",
    readCreatedId,
  );
}

export function clerkPlaceTelephoneBid(input: {
  lotId: string;
  buyerUserId: string;
  buyerLegalEntityId: string;
  amount: number;
  telephoneBookingId: string;
}) {
  return sendClerkCommand(
    "/admin/saleroom/telephone-bids",
    {
      body: {
        lotId: input.lotId,
        buyerUserId: input.buyerUserId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        amount: input.amount,
        telephoneBookingId: input.telephoneBookingId,
      },
    },
    "Telephone bid failed",
    readCreatedId,
  );
}

export function clerkTelephoneLine(input: {
  saleId: string;
  bookingId: string;
  lotId: string;
  step: "start-line" | "complete-line";
}) {
  return sendClerkCommand(
    telephoneBookingPath(input.saleId, input.bookingId, input.step),
    { body: { lotId: input.lotId } },
    input.step === "start-line" ? "Start line failed" : "Complete line failed",
  );
}
