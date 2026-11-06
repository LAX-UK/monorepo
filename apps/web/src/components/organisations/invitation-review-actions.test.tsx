import type { PendingInvitationRow } from "@/lib/legal-entity/pending-invitations.gateway.server";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const accept = vi.fn();
vi.mock("@/lib/legal-entity/invitation.actions", () => ({
  acceptInvitationByIdAction: (...args: unknown[]) => accept(...args),
  declineInvitationByIdAction: vi.fn(),
}));

const choose = vi.fn(async () => {});
vi.mock("@/components/layout/account-switcher/use-account-switch", () => ({
  useAccountSwitch: () => ({ pendingId: null, choose }),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));

import { InvitationReviewActions } from "./invitation-review-actions";

const invitation = { id: "inv-1", orgDisplayName: "Northbank Gallery" } as PendingInvitationRow;

describe("InvitationReviewActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches to the organisation and loads it afresh, never through the client router", async () => {
    accept.mockResolvedValue({ ok: true, data: { legalEntityId: "org-1" } });
    render(<InvitationReviewActions invitation={invitation} />);

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => expect(choose).toHaveBeenCalledWith({ id: "org-1", current: false }));
    expect(push).not.toHaveBeenCalled();
  });
});
