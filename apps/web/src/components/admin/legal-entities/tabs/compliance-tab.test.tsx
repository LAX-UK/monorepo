import type { LegalEntity } from "@auction/types";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LegalEntityComplianceTab } from "./compliance-tab";

const refresh = vi.fn();
const liftAction = vi.fn();
const restrictAction = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/admin/legal-entity-lifecycle.actions", () => ({
  legalEntityLifecycleSimpleAction: vi.fn(),
  legalEntityLiftRestrictionResultAction: (...args: unknown[]) => liftAction(...args),
  legalEntityRestrictResultAction: (...args: unknown[]) => restrictAction(...args),
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
    for (const fn of [refresh, liftAction, restrictAction, notifySuccess]) fn.mockReset();
  });

  it("shows the action to a restricted organisation for people who may use it", () => {
    render(<LegalEntityComplianceTab entity={restricted} canManageRestriction />);
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
        canManageRestriction
      />,
    );
    expect(lift()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restrict" })).toBeInTheDocument();
  });

  it("asks for a reason, then lifts and refreshes the page", async () => {
    liftAction.mockResolvedValue({ ok: true });
    render(<LegalEntityComplianceTab entity={restricted} canManageRestriction />);
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
        canManageRestriction
      />,
    );
    fireEvent.click(lift() as HTMLElement);
    expect(screen.getByText(/moves to Connect pending/)).toBeInTheDocument();
  });

  it("keeps a failure in the dialog", async () => {
    liftAction.mockResolvedValue({ ok: false, error: "Cannot apply lift_restriction" });
    render(<LegalEntityComplianceTab entity={restricted} canManageRestriction />);
    fireEvent.click(lift() as HTMLElement);
    fireEvent.change(screen.getByLabelText("Reason for lifting"), { target: { value: REASON } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Lift restriction" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByText("Cannot apply lift_restriction")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("LegalEntityComplianceTab restrict", () => {
  const approved = { ...restricted, status: "approved" } as LegalEntity;
  const restrictButton = () => screen.queryByRole("button", { name: "Restrict" });

  beforeEach(() => {
    for (const fn of [refresh, restrictAction, notifySuccess]) fn.mockReset();
  });

  it("hides Restrict from people without the capability", () => {
    render(<LegalEntityComplianceTab entity={approved} />);
    expect(restrictButton()).not.toBeInTheDocument();
  });

  it("asks for a reason, says what restriction does, then restricts and refreshes", async () => {
    restrictAction.mockResolvedValue({ ok: true });
    render(<LegalEntityComplianceTab entity={approved} canManageRestriction />);
    fireEvent.click(restrictButton() as HTMLElement);

    expect(screen.getByRole("heading", { name: "Restrict Gallery One?" })).toBeInTheDocument();
    expect(
      screen.getByText(/Bidding, registering and sending works are paused/),
    ).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Restrict organisation" });
    fireEvent.click(confirm);
    expect(restrictAction).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Reason for restricting"), {
      target: { value: REASON },
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(restrictAction).toHaveBeenCalledWith("le_1", REASON, ""));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(notifySuccess).toHaveBeenCalledWith("Gallery One restricted");
  });

  it("sends the message the members read, kept apart from the reason", async () => {
    restrictAction.mockResolvedValue({ ok: true });
    render(<LegalEntityComplianceTab entity={approved} canManageRestriction />);
    fireEvent.click(restrictButton() as HTMLElement);
    fireEvent.change(screen.getByLabelText("Reason for restricting"), {
      target: { value: REASON },
    });
    fireEvent.change(
      within(screen.getByRole("dialog")).getByLabelText(
        "Message to the organisation (shown to its members)",
      ),
      { target: { value: "Please send an updated proof of address." } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Restrict organisation" }));
    await waitFor(() =>
      expect(restrictAction).toHaveBeenCalledWith(
        "le_1",
        REASON,
        "Please send an updated proof of address.",
      ),
    );
  });

  it("shows the message already set to staff, labelled as the members' message", () => {
    render(
      <LegalEntityComplianceTab
        entity={{ ...restricted, clientMessage: "We need a proof of address." } as LegalEntity}
      />,
    );
    expect(screen.getByText("Message to members")).toBeInTheDocument();
    expect(screen.getByText("We need a proof of address.")).toBeInTheDocument();
  });
});
