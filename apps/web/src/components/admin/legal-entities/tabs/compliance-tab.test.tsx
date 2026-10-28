import type { LegalEntity } from "@auction/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LegalEntityComplianceTab } from "./compliance-tab";

const refresh = vi.fn();
const liftAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/admin/legal-entity-lifecycle.actions", () => ({
  legalEntityLifecycleSimpleAction: vi.fn(),
  legalEntityLiftRestrictionResultAction: (...args: unknown[]) => liftAction(...args),
  legalEntityRejectAction: vi.fn(),
  legalEntityArchiveAction: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const REASON = "Documents re-verified by compliance";

const restricted = {
  id: "le_1",
  displayName: "Gallery One",
  status: "restricted",
  statusReason: null,
  statusChangedAt: null,
  isLaxManaged: false,
  stripeConnectAccountId: "acct_1",
  stripeConnectChargesEnabled: true,
  stripeConnectPayoutsEnabled: true,
  stripeConnectRequirementsCurrentlyDue: [],
  stripeConnectRequirementsErrors: [],
  stripeConnectDisabledReason: null,
} as unknown as LegalEntity;

function lift() {
  return screen.queryByRole("button", { name: "Lift restriction" });
}

describe("LegalEntityComplianceTab lift restriction", () => {
  beforeEach(() => {
    for (const fn of [refresh, liftAction, notifySuccess]) fn.mockReset();
  });

  it("shows the action to a restricted organisation for people who may use it", () => {
    render(<LegalEntityComplianceTab entity={restricted} canLiftRestriction />);
    expect(lift()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restrict" })).not.toBeInTheDocument();
  });

  it("hides the action from people without the capability", () => {
    render(<LegalEntityComplianceTab entity={restricted} />);
    expect(lift()).not.toBeInTheDocument();
  });

  it("hides the action when the organisation is not restricted", () => {
    render(
      <LegalEntityComplianceTab
        entity={{ ...restricted, status: "approved" } as LegalEntity}
        canLiftRestriction
      />,
    );
    expect(lift()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restrict" })).toBeInTheDocument();
  });

  it("asks for a reason, then lifts and refreshes the page", async () => {
    liftAction.mockResolvedValue({ ok: true });
    render(<LegalEntityComplianceTab entity={restricted} canLiftRestriction />);
    fireEvent.click(lift() as HTMLElement);

    expect(
      screen.getByRole("heading", { name: "Lift the restriction on Gallery One?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/returns to approved/)).toBeInTheDocument();

    const confirm = screen.getAllByRole("button", { name: "Lift restriction" }).at(-1);
    fireEvent.click(confirm as HTMLElement);
    expect(liftAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for lifting"), { target: { value: REASON } });
    fireEvent.click(confirm as HTMLElement);
    await waitFor(() => expect(liftAction).toHaveBeenCalledWith("le_1", REASON));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalledWith("Gallery One approved again");
  });

  it("says the organisation waits for Connect when Stripe is not ready", () => {
    render(
      <LegalEntityComplianceTab
        entity={{ ...restricted, stripeConnectPayoutsEnabled: false } as LegalEntity}
        canLiftRestriction
      />,
    );
    fireEvent.click(lift() as HTMLElement);
    expect(screen.getByText(/moves to Connect pending/)).toBeInTheDocument();
  });

  it("keeps a failure in the dialog", async () => {
    liftAction.mockResolvedValue({ ok: false, error: "Cannot apply lift_restriction" });
    render(<LegalEntityComplianceTab entity={restricted} canLiftRestriction />);
    fireEvent.click(lift() as HTMLElement);
    fireEvent.change(screen.getByLabelText("Reason for lifting"), { target: { value: REASON } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Lift restriction" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByText("Cannot apply lift_restriction")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
