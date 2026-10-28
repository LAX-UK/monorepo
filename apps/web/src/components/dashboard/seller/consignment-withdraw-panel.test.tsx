import { withdrawConsignmentAction } from "@/lib/actions/consignment-after-sale";
import { partCSection } from "@/lib/legal/conditions-of-business-part-c";
import { consignmentWithdrawalViewModel } from "@/lib/seller/consignment-withdrawal-view";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsignmentWithdrawPanel } from "./consignment-withdraw-panel";

vi.mock("@/lib/actions/consignment-after-sale", () => ({ withdrawConsignmentAction: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const terms = partCSection("withdrawal-by-seller");

describe("ConsignmentWithdrawPanel", () => {
  beforeEach(() => vi.mocked(withdrawConsignmentAction).mockReset());

  it("shows the withdrawal conditions before asking staff", async () => {
    vi.mocked(withdrawConsignmentAction).mockResolvedValue({
      ok: true,
      data: { kind: "requested" },
    });
    render(
      <ConsignmentWithdrawPanel
        submissionId="s1"
        terms={terms}
        view={consignmentWithdrawalViewModel({ path: "request", canAct: true, request: null })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask to withdraw" }));
    expect(await screen.findByText("28. Withdrawal by Seller")).toBeTruthy();
    expect(screen.getByText(/may not withdraw a lot once it has been catalogued/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(withdrawConsignmentAction).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("says who may act instead of offering the button", () => {
    render(
      <ConsignmentWithdrawPanel
        submissionId="s1"
        terms={terms}
        view={consignmentWithdrawalViewModel({ path: "request", canAct: false, request: null })}
      />,
    );
    expect(
      screen.getByText("Only an owner or admin can ask to withdraw a catalogued lot."),
    ).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a waiting request, and nothing when it cannot be withdrawn", () => {
    const { rerender } = render(
      <ConsignmentWithdrawPanel
        submissionId="s1"
        terms={terms}
        view={{ mode: "requested", message: "You asked to withdraw this lot on 21 Oct 2026." }}
      />,
    );
    expect(screen.getByText("You asked to withdraw this lot on 21 Oct 2026.")).toBeTruthy();
    rerender(
      <ConsignmentWithdrawPanel submissionId="s1" terms={terms} view={{ mode: "hidden" }} />,
    );
    expect(screen.queryByText(/withdraw/i)).toBeNull();
  });
});
