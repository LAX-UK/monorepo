import { SaleroomCheckInPanel } from "@/components/admin/saleroom-check-in-panel";
import { checkInBidder, searchCheckInCandidates } from "@/lib/admin/saleroom/check-in.client";
import type { AdminCheckInCandidate } from "@/lib/data/http/admin-sale-registrations.types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("@/lib/admin/saleroom/check-in.client", () => ({
  searchCheckInCandidates: vi.fn(),
  checkInBidder: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

const SALE = "11111111-1111-4111-8111-111111111111";
const ENTITY = "33333333-3333-4333-8333-333333333333";

const jane: AdminCheckInCandidate = {
  userId: "user-1",
  name: "Jane Doe",
  email: "jane@example.com",
  emailVerified: true,
  kycStatus: "approved",
  suspended: false,
  eligibleEntities: [
    {
      id: ENTITY,
      displayName: "Jane Doe",
      role: "owner",
      kind: "individual",
      existingRegistration: null,
    },
  ],
};

async function search(text: string) {
  vi.useFakeTimers();
  fireEvent.change(screen.getByPlaceholderText("Name or email"), { target: { value: text } });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  vi.useRealTimers();
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SaleroomCheckInPanel", () => {
  it("searches and checks in through the BFF client, not a server action", async () => {
    vi.mocked(searchCheckInCandidates).mockResolvedValue({ ok: true, data: { items: [jane] } });
    vi.mocked(checkInBidder).mockResolvedValue({
      ok: true,
      data: { registrationId: "reg-1", paddleNumber: 104, checkedInAt: "2026-11-16T10:00:00Z" },
    });

    render(<SaleroomCheckInPanel saleId={SALE} />);
    await search("jane");

    expect(searchCheckInCandidates).toHaveBeenCalledWith({ saleId: SALE, q: "jane" });
    fireEvent.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check in and assign paddle" }));
    });

    expect(checkInBidder).toHaveBeenCalledWith({
      saleId: SALE,
      userId: "user-1",
      buyerLegalEntityId: ENTITY,
      assignPaddle: true,
    });
    expect(await screen.findByText("Paddle 104 assigned to Jane Doe")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a refused check-in on the panel instead of throwing into the error boundary", async () => {
    vi.mocked(searchCheckInCandidates).mockResolvedValue({ ok: true, data: { items: [jane] } });
    vi.mocked(checkInBidder).mockResolvedValue({
      ok: false,
      error: "Paddle taken",
      status: 409,
      errorCode: "paddle_taken",
    });

    render(<SaleroomCheckInPanel saleId={SALE} />);
    await search("jane");
    fireEvent.click(screen.getByRole("button", { name: /Jane Doe/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Check in and assign paddle" }));
    });

    expect(
      await screen.findByText(
        "That paddle number is already in use. Try another or leave blank to auto-assign.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a failed search under the search field", async () => {
    vi.mocked(searchCheckInCandidates).mockResolvedValue({
      ok: false,
      error: "The saleroom could not be reached. Check the connection, then try again.",
    });

    render(<SaleroomCheckInPanel saleId={SALE} />);
    await search("jane");

    expect(
      await screen.findByText(
        "The saleroom could not be reached. Check the connection, then try again.",
      ),
    ).toBeInTheDocument();
  });
});
