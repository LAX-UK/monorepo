import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const success = vi.fn();
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...a: unknown[]) => success(...a), error: vi.fn() },
}));
const remindTwoStepAction = vi.fn();
const setOrgTwoFactorPolicyAction = vi.fn();
vi.mock("@/lib/security/two-factor-policy.actions", () => ({
  remindTwoStepAction: (...a: unknown[]) => remindTwoStepAction(...a),
  setOrgTwoFactorPolicyAction: (...a: unknown[]) => setOrgTwoFactorPolicyAction(...a),
}));

import { TwoStepPolicyPanel } from "./two-step-policy-panel";

const impact = {
  coverage: "2 of 3 people",
  percent: 67,
  missingLine: "Tom Whitfield doesn't have it on.",
  affected: [{ userId: "tom", name: "Tom Whitfield", detail: "Buyer agent" }],
};

function renderPanel(props: Partial<Parameters<typeof TwoStepPolicyPanel>[0]> = {}) {
  return render(
    <TwoStepPolicyPanel
      legalEntityId="org"
      organisationName="Northbank Gallery"
      required={false}
      impact={impact}
      canEdit
      canRemind
      {...props}
    />,
  );
}

describe("TwoStepPolicyPanel reminders", () => {
  beforeEach(() => {
    remindTwoStepAction.mockReset();
    setOrgTwoFactorPolicyAction.mockReset();
    success.mockReset();
  });

  it("reminds the people without two-step and says how many were emailed", async () => {
    remindTwoStepAction.mockResolvedValue({ ok: true, reminded: 1 });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remind them" }));
    await waitFor(() => expect(remindTwoStepAction).toHaveBeenCalledWith("org"));
    await waitFor(() => expect(success).toHaveBeenCalledWith("We emailed 1 person a reminder"));
  });

  it("shows why a reminder can't go yet", async () => {
    remindTwoStepAction.mockResolvedValue({
      ok: false,
      error: "A reminder was sent in the last day.",
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Remind them" }));
    expect(await screen.findByText("A reminder was sent in the last day.")).toBeInTheDocument();
  });

  it("emails a reminder when two-step is required, unless switched off", async () => {
    setOrgTwoFactorPolicyAction.mockResolvedValue({ ok: true });
    remindTwoStepAction.mockResolvedValue({ ok: true, reminded: 1 });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Require two-step" }));
    expect(screen.getByRole("switch", { name: "Email them a reminder now" })).toBeChecked();
    const confirm = screen.getAllByRole("button", { name: "Require two-step" }).at(-1);
    if (!confirm) throw new Error("no confirm button");
    fireEvent.click(confirm);
    await waitFor(() => expect(remindTwoStepAction).toHaveBeenCalledWith("org"));
  });

  it("offers no reminder to people who can't send one, or when everyone has it on", () => {
    const { unmount } = renderPanel({ canRemind: false });
    expect(screen.queryByRole("button", { name: "Remind them" })).not.toBeInTheDocument();
    unmount();
    renderPanel({ impact: { ...impact, missingLine: null, affected: [] } });
    expect(screen.queryByRole("button", { name: "Remind them" })).not.toBeInTheDocument();
  });
});
