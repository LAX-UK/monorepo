import { InvitationRevokeButton } from "@/components/admin/invitation-revoke-button";
import { InvitationRowActions } from "@/components/admin/invitation-row-actions";
import {
  adminResendInvitationResultAction,
  adminRevokeInvitationResultAction,
} from "@/lib/actions/admin/admin-invitations";
import { actionSuccess } from "@/lib/forms/form-result";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

vi.mock("@/lib/actions/admin/admin-invitations", () => ({
  adminResendInvitationResultAction: vi.fn(),
  adminRevokeInvitationResultAction: vi.fn(),
}));

const mockFetchAdminInvitationsPage = vi.fn();
vi.mock("@/lib/data/http/invitations.client", () => ({
  fetchAdminInvitationsPage: (...args: unknown[]) => mockFetchAdminInvitationsPage(...args),
}));

vi.mock("@/lib/ui/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

const resendableLifecycle = {
  status: "pending",
  expiresAt: new Date(Date.now() + 86_400_000),
  openedAt: null,
  inviteEmailLastStatus: null,
};

describe("Invitation row actions — refresh without client refetch", () => {
  it("calls router.refresh once and does not fetch invitations on resend success", async () => {
    mockRefresh.mockReset();
    mockFetchAdminInvitationsPage.mockReset();
    vi.mocked(adminResendInvitationResultAction).mockResolvedValue(actionSuccess());

    render(<InvitationRowActions invitationId="inv-1" lifecycle={resendableLifecycle} />);

    fireEvent.click(screen.getByRole("button", { name: /^resend$/i }));

    await waitFor(() => {
      expect(adminResendInvitationResultAction).toHaveBeenCalledWith("inv-1");
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFetchAdminInvitationsPage).not.toHaveBeenCalled();
  });

  it("calls router.refresh once and does not fetch invitations on revoke success", async () => {
    mockRefresh.mockReset();
    mockFetchAdminInvitationsPage.mockReset();
    vi.mocked(adminRevokeInvitationResultAction).mockResolvedValue(actionSuccess());

    render(<InvitationRevokeButton invitationId="inv-2" />);

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => {
      expect(adminRevokeInvitationResultAction).toHaveBeenCalledWith("inv-2");
    });

    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockFetchAdminInvitationsPage).not.toHaveBeenCalled();
  });
});
