import { useBidAttention } from "@/hooks/use-bid-attention";
import type { SessionUser } from "@/lib/data/contracts";
import { NO_ATTENTION } from "@/lib/navigation/client-attention";
import { markLotEnded, resetEndedLots } from "@/lib/navigation/ended-lots";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let user: SessionUser | null;
let pending = false;
let context: { attention: typeof NO_ATTENTION } | null;

vi.mock("@/lib/auth/use-app-session", () => ({ useAppSession: () => ({ user, pending }) }));
vi.mock("@/lib/auth/client-audience", () => ({
  usesBidAsClient: (person: { role: string }) => person.role === "client",
}));
vi.mock("@/lib/navigation/use-account-menu-context.client", () => ({
  useAccountMenuContext: () => context,
}));

const client = { id: "u1", name: "J", email: "j@x.co", role: "client" } as unknown as SessionUser;
const staff = {
  id: "s1",
  name: "S",
  email: "s@x.co",
  role: "staff",
} as unknown as SessionUser;

beforeEach(() => {
  user = client;
  pending = false;
  context = null;
  resetEndedLots();
});

describe("useBidAttention", () => {
  it("has nothing for a guest", () => {
    user = null;
    const { result } = renderHook(() => useBidAttention());
    expect(result.current).toMatchObject({ signedIn: false, attention: null, chip: null });
  });

  it("names the signed-in person for the Account tab's avatar", () => {
    const { result } = renderHook(() => useBidAttention());
    expect(result.current.viewer).toMatchObject({ email: expect.any(String) });
  });

  it("has nothing until the client's facts load", () => {
    const { result } = renderHook(() => useBidAttention());
    expect(result.current).toMatchObject({ signedIn: true, attention: null, chip: null });
  });

  it("derives the chip from the loaded facts, outbid first", () => {
    context = { attention: { ...NO_ATTENTION, outbidLots: ["3"], paymentsDue: 1 } };
    const { result } = renderHook(() => useBidAttention());
    expect(result.current.attention?.outbidLots).toEqual(["3"]);
    expect(result.current.chip?.kind).toBe("outbid");
  });

  it("derives a payment due prompt", () => {
    context = { attention: { ...NO_ATTENTION, paymentsDue: 2 } };
    const { result } = renderHook(() => useBidAttention());
    expect(result.current.chip?.kind).toBe("payment-due");
  });

  it("never shows staff a client prompt", () => {
    user = staff;
    context = { attention: { ...NO_ATTENTION, paymentsDue: 2 } };
    const { result } = renderHook(() => useBidAttention());
    expect(result.current).toMatchObject({ signedIn: true, attention: null, chip: null });
  });

  describe("when the outbid lot closes", () => {
    const outbidOn = (lotId: string) => ({
      attention: {
        ...NO_ATTENTION,
        outbidLots: ["3"],
        groups: [
          {
            kind: "outbid" as const,
            count: 1,
            url: "/bids?tab=active",
            items: [
              { kind: "outbid" as const, lotId, title: "Harbour at Dawn", url: `/lots/${lotId}` },
            ],
          },
        ],
      },
    });

    it("clears the outbid prompt as soon as that lot ends", () => {
      context = outbidOn("lot-1");
      const { result } = renderHook(() => useBidAttention());
      expect(result.current.chip?.label).toBe("Outbid on Harbour at Dawn");

      act(() => markLotEnded("lot-1"));

      expect(result.current.chip).toBeNull();
      expect(result.current.attention?.outbidLots).toEqual([]);
    });

    it("keeps the prompt when a different lot ends", () => {
      context = outbidOn("lot-1");
      const { result } = renderHook(() => useBidAttention());

      act(() => markLotEnded("lot-2"));

      expect(result.current.chip?.kind).toBe("outbid");
    });
  });
});
