import { acceptConsignmentAgreementAction } from "@/lib/actions/consignment-agreement";
import { CONDITIONS_OF_BUSINESS_PART_C } from "@/lib/legal/conditions-of-business-part-c";
import type { ConsignmentAgreement } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsignmentAgreementPanel } from "./consignment-agreement-panel";

vi.mock("@/lib/actions/consignment-agreement", () => ({
  acceptConsignmentAgreementAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const agreement: ConsignmentAgreement = {
  id: "agr-1",
  submissionId: "sub-1",
  legalEntityId: "le-1",
  termsVersion: "conditions-of-business-part-c-v1",
  estimateLow: "8000.00",
  estimateHigh: "12000.00",
  reservePrice: "7000.00",
  commissionPercent: "15.00",
  currency: "GBP",
  proposedAt: new Date("2026-10-04T10:00:00Z"),
  acceptedAt: null,
  acceptedByUserId: null,
  acceptedByName: null,
};

function renderPanel(props: Partial<Parameters<typeof ConsignmentAgreementPanel>[0]> = {}) {
  render(
    <ConsignmentAgreementPanel
      agreement={agreement}
      canAccept
      accountName="Jane Smith"
      accountKind="personal"
      conditions={CONDITIONS_OF_BUSINESS_PART_C}
      {...props}
    />,
  );
}

describe("ConsignmentAgreementPanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the specialist's estimate and terms with the seller conditions to read", () => {
    renderPanel();
    expect(screen.getByRole("heading", { name: "Consignment agreement" })).toBeVisible();
    expect(screen.getByText("£8,000 – £12,000")).toBeVisible();
    expect(screen.getByText("15%")).toBeVisible();
    expect(screen.getByText("20. Submission and Acceptance of Property")).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Conditions for Sellers and Consignors" }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("accepts only after the person confirms they read it, at the version shown", async () => {
    vi.mocked(acceptConsignmentAgreementAction).mockResolvedValue({ ok: true, data: undefined });
    renderPanel();
    const button = screen.getByRole("button", { name: "Accept agreement" });
    expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);
    await waitFor(() => {
      expect(acceptConsignmentAgreementAction).toHaveBeenCalledWith(
        "sub-1",
        "conditions-of-business-part-c-v1",
      );
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("keeps a refusal on the panel", async () => {
    vi.mocked(acceptConsignmentAgreementAction).mockResolvedValue({
      ok: false,
      error: "The agreement has changed since you opened it.",
    });
    renderPanel();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Accept agreement" }));
    expect(await screen.findByText("The agreement has changed since you opened it.")).toBeVisible();
  });

  it("names the organisation on the confirmation", () => {
    renderPanel({ accountKind: "organisation", accountName: "Northbank Gallery" });
    expect(
      screen.getByLabelText(
        "I have read the conditions and accept the agreement for Northbank Gallery.",
      ),
    ).toBeInTheDocument();
  });

  it("tells members who cannot accept who can", () => {
    renderPanel({
      canAccept: false,
      accountKind: "organisation",
      accountName: "Northbank Gallery",
    });
    expect(screen.queryByRole("button", { name: "Accept agreement" })).not.toBeInTheDocument();
    expect(
      screen.getByText("Only an owner or admin of Northbank Gallery can accept this agreement."),
    ).toBeVisible();
  });

  it("asks nothing of the seller until the specialist sends the estimate and terms", () => {
    renderPanel({
      agreement: { ...agreement, estimateLow: null, estimateHigh: null, commissionPercent: null },
    });
    expect(
      screen.getByText(
        "Your specialist will send the estimate and terms. You'll read and accept them here.",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Accept agreement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("records who accepted, when and which version", () => {
    renderPanel({
      agreement: {
        ...agreement,
        acceptedAt: new Date("2026-10-05T12:00:00Z"),
        acceptedByUserId: "u1",
        acceptedByName: "Jane Smith",
      },
    });
    expect(screen.getByTestId("agreement-accepted")).toHaveTextContent(
      "Accepted by Jane Smith on 5 Oct 2026 · Version 1",
    );
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
