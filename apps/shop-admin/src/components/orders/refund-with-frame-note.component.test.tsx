// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/orders/1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/server/application/admin-operations-actions.server", () => ({
  requestOrderRefund: vi.fn(),
}));

const { RefundWithFrameNote } = await import("./refund-dialog.client");

describe("RefundWithFrameNote", () => {
  afterEach(cleanup);

  it("states the item, its frame and the total before the refund is confirmed", () => {
    render(<RefundWithFrameNote itemPence={30_000} framePence={21_000} frameMade={false} />);
    expect(screen.getByText("This also refunds the frame")).toBeInTheDocument();
    expect(
      screen.getByText(/£300\.00 for this item and £210\.00 for its frame, £510\.00 in all\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/The frame is not made\./)).toBeInTheDocument();
  });

  it("says so when the frame has already been made", () => {
    render(<RefundWithFrameNote itemPence={30_000} framePence={21_000} frameMade />);
    expect(screen.getByText(/The frame has already been made/)).toBeInTheDocument();
    expect(screen.queryByText(/The frame is not made\./)).toBeNull();
  });
});
