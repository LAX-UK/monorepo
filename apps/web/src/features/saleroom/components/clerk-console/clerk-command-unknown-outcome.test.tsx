import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { TelephoneLinesPanel } from "@/features/saleroom/components/clerk-console/telephone-lines-panel";
import { useClerkBidEntry } from "@/features/saleroom/hooks/use-clerk-bid-entry";
import {
  clerkAdvance,
  clerkDisplayApprove,
  clerkDisplayRevoke,
  setClerkCommandFetchForTests,
} from "@/features/saleroom/lib/clerk-commands.client";
import { ClerkRoomRecheckContext } from "@/features/saleroom/lib/clerk-room-recheck";
import type { AdminTelephoneBookingRow } from "@/lib/data/http/admin.server";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every clerk command other than hammer and pass (which have their own hold control): advance,
 * telephone line start and complete, display approve and revoke, and paddle and telephone bids.
 * A command that fails or goes unanswered may have landed, so the console never says it worked
 * and never sends it again: it says the outcome is unknown, re-reads the room, then shows the
 * error. Only the transport is a fake; the real command functions run.
 */

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), loading: vi.fn() },
}));

const SALE = "11111111-1111-4111-8111-111111111111";
const LOT = "22222222-2222-4222-8222-222222222222";
const BOOKING = "33333333-3333-4333-8333-333333333333";
const UNKNOWN = "Outcome unknown, checking the room…";
const UNREACHABLE = "The saleroom could not be reached. Check the connection, then try again.";

const lostResponse = () =>
  vi.fn(async () => {
    throw new TypeError("Failed to fetch");
  });
const serverError = () =>
  vi.fn(
    async () =>
      new Response(JSON.stringify({ error: "Upstream timed out" }), {
        status: 504,
        headers: { "content-type": "application/json" },
      }),
  );

/** A recheck the test answers by hand, so it can see what the clerk is told while it runs. */
function deferredRecheck() {
  let answer: () => void = () => {};
  const recheck = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        answer = resolve;
      }),
  );
  return { recheck, answer: () => answer() };
}

function withRecheck(recheck: () => Promise<unknown>) {
  return ({ children }: { children: ReactNode }) => (
    <ClerkRoomRecheckContext.Provider value={recheck}>{children}</ClerkRoomRecheckContext.Provider>
  );
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  setClerkCommandFetchForTests(null);
});

const buttonCommands: Array<{
  name: string;
  label: string;
  run: () => Promise<ActionResult<unknown>>;
}> = [
  { name: "advance", label: "Advance next", run: () => clerkAdvance({ saleId: SALE, lotId: LOT }) },
  {
    name: "display approve",
    label: "Approve display",
    run: () => clerkDisplayApprove({ saleId: SALE, userCode: "abcd-1234" }),
  },
  {
    name: "display revoke",
    label: "Revoke display",
    run: () => clerkDisplayRevoke({ saleId: SALE, pairingId: BOOKING }),
  },
];

describe("clerk command buttons when the outcome is unknown", () => {
  for (const command of buttonCommands) {
    for (const [failure, transport, error] of [
      ["unreachable", lostResponse, UNREACHABLE],
      ["non-2xx", serverError, "Upstream timed out"],
    ] as const) {
      it(`${command.name}, ${failure}: says unknown, rechecks the room, then shows the error`, async () => {
        const server = transport();
        setClerkCommandFetchForTests(server);
        const { recheck, answer } = deferredRecheck();
        const onSuccess = vi.fn();
        const Wrapper = withRecheck(recheck);

        render(
          <Wrapper>
            <SaleroomPendingSubmit
              pendingLabel="Working…"
              successMessage="Done"
              onRun={command.run}
              onSuccess={onSuccess}
            >
              {command.label}
            </SaleroomPendingSubmit>
          </Wrapper>,
        );
        fireEvent.click(screen.getByRole("button", { name: command.label }));
        await flush();

        expect(server).toHaveBeenCalledTimes(1);
        expect(notify.loading).toHaveBeenCalledWith(UNKNOWN, { id: expect.any(String) });
        expect(recheck).toHaveBeenCalledTimes(1);
        // The error waits for the room to be read again.
        expect(notify.error).not.toHaveBeenCalled();

        await act(async () => {
          answer();
        });
        await flush();

        const toastId = vi.mocked(notify.loading).mock.calls[0]?.[1]?.id;
        expect(notify.error).toHaveBeenCalledWith(error, { id: toastId });
        expect(notify.success).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
        // Never resent: it may have landed.
        expect(server).toHaveBeenCalledTimes(1);
      });
    }
  }

  it("refreshes the page outside the console, where no recheck is provided", async () => {
    setClerkCommandFetchForTests(lostResponse());

    render(
      <SaleroomPendingSubmit
        pendingLabel="Advancing…"
        onRun={() => clerkAdvance({ saleId: SALE, lotId: LOT })}
      >
        Advance next
      </SaleroomPendingSubmit>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance next" }));
    await flush();

    expect(notify.loading).toHaveBeenCalledWith(UNKNOWN, { id: expect.any(String) });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(notify.error).toHaveBeenCalledWith(UNREACHABLE, { id: expect.any(String) });
  });
});

const booking = {
  id: BOOKING,
  saleId: SALE,
  userId: "user-1",
  buyerLegalEntityId: "le-1",
  userName: "Tel buyer",
  userEmail: null,
  buyerLegalEntityDisplayName: null,
  phoneDisplay: null,
  phoneE164: "+447700900123",
  lotIds: [LOT],
  authorizedMax: "5000.00",
  status: "in_progress",
  clerkUserId: null,
  notes: null,
  buyerNotes: null,
  approvedByUserId: null,
  completedLotIds: [],
} as unknown as AdminTelephoneBookingRow;

describe("telephone lines when the outcome is unknown", () => {
  for (const label of ["Start line", "Complete line"]) {
    it(`${label}: says unknown, rechecks the room, then shows the error, sent once`, async () => {
      const server = lostResponse();
      setClerkCommandFetchForTests(server);
      const { recheck, answer } = deferredRecheck();
      const Wrapper = withRecheck(recheck);

      render(
        <Wrapper>
          <TelephoneLinesPanel saleId={SALE} currentLotId={LOT} rows={[booking]} />
        </Wrapper>,
      );
      fireEvent.click(screen.getByRole("button", { name: label }));
      await flush();

      expect(notify.loading).toHaveBeenCalledWith(UNKNOWN, { id: expect.any(String) });
      expect(recheck).toHaveBeenCalledTimes(1);
      expect(notify.error).not.toHaveBeenCalled();
      await act(async () => {
        answer();
      });
      await flush();
      expect(notify.error).toHaveBeenCalledWith(UNREACHABLE, { id: expect.any(String) });
      expect(notify.success).not.toHaveBeenCalled();
      expect(server).toHaveBeenCalledTimes(1);
    });
  }
});

describe("paddle and telephone bid entry when the outcome is unknown", () => {
  const options = {
    saleId: SALE,
    currentLotId: LOT,
    liveCurrentPrice: "100.00",
    minBidIncrement: "10.00",
    telephoneBookings: [booking],
    paddleRoster: [{ paddleNumber: 142, displayName: "Jane Doe" }],
  };

  it("paddle bid with a lost response: unknown, recheck, then the error; never placed or resent", async () => {
    const server = lostResponse();
    setClerkCommandFetchForTests(server);
    const { recheck, answer } = deferredRecheck();

    const { result } = renderHook(() => useClerkBidEntry(options), {
      wrapper: withRecheck(recheck),
    });
    act(() => {
      result.current.setPaddleNumber("142");
      result.current.setPaddleAmount("150");
    });
    await act(async () => {
      result.current.placePaddleBid();
    });
    await flush();

    expect(notify.loading).toHaveBeenCalledWith(UNKNOWN, { id: "clerk-paddle-bid" });
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(notify.error).not.toHaveBeenCalled();
    await act(async () => {
      answer();
    });
    await flush();
    expect(notify.error).toHaveBeenCalledWith(UNREACHABLE, { id: "clerk-paddle-bid" });
    expect(notify.success).not.toHaveBeenCalled();
    expect(server).toHaveBeenCalledTimes(1);
    // The amount is kept: the clerk sees the room's price before deciding what to do.
    expect(result.current.state.paddleAmount).toBe("150");
  });

  it("telephone bid with a non-2xx answer: unknown, recheck, then the error; never placed or resent", async () => {
    const server = serverError();
    setClerkCommandFetchForTests(server);
    const { recheck, answer } = deferredRecheck();

    const { result } = renderHook(() => useClerkBidEntry(options), {
      wrapper: withRecheck(recheck),
    });
    act(() => {
      result.current.setBookingId(BOOKING);
      result.current.setTelephoneAmount("150");
    });
    await act(async () => {
      result.current.placeTelephoneBid();
    });
    await flush();

    expect(notify.loading).toHaveBeenCalledWith(UNKNOWN, { id: "clerk-telephone-bid" });
    expect(recheck).toHaveBeenCalledTimes(1);
    expect(notify.error).not.toHaveBeenCalled();
    await act(async () => {
      answer();
    });
    await flush();
    expect(notify.error).toHaveBeenCalledWith("Upstream timed out", {
      id: "clerk-telephone-bid",
    });
    expect(notify.success).not.toHaveBeenCalled();
    expect(server).toHaveBeenCalledTimes(1);
  });
});
