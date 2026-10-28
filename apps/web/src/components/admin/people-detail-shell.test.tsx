import type { AdminUserDetailPayload } from "@/lib/data/http/admin.server";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render as baseRender, fireEvent, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { PeopleDetailShell } from "./people-detail-shell";

// The overflow menu is a Radix popover, slow to open in jsdom; it renders its actions in place.
vi.mock("@auction/staff-ui", async (importOriginal) => {
  const kit = await importOriginal<typeof import("@auction/staff-ui")>();
  return {
    ...kit,
    OverflowMenu: ({
      actions,
      label,
    }: {
      actions: readonly { id: string; label: string; tone?: string; onSelect?: () => void }[];
      label: string;
    }) => (
      <ul aria-label={label}>
        {actions.map((action) => (
          <li key={action.id}>
            <button type="button" role="menuitem" data-tone={action.tone} onClick={action.onSelect}>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    ),
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/clients/user_1",
}));
vi.mock("@/lib/actions/admin", () => ({
  adminResetTwoFactorResultAction: vi.fn(),
  adminSetUserRoleResultAction: vi.fn(),
  adminSuspendUserResultAction: vi.fn(),
  adminUnsuspendUserResultAction: vi.fn(),
}));
vi.mock("@/lib/actions/admin/field-updates", () => ({
  adminUpdateClientDisplayNameFieldAction: vi.fn(),
}));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  startAdminImpersonationAfterLookup: vi.fn(),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn(), action: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

const render = (ui: ReactElement) => baseRender(<StaffTooltipProvider>{ui}</StaffTooltipProvider>);

function client(overrides: Partial<AdminUserDetailPayload> = {}): AdminUserDetailPayload {
  return {
    id: "user_1",
    email: "ada@example.com",
    name: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    role: "client",
    staffRole: null,
    createdAt: "2026-03-12T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
    suspendedAt: null,
    image: null,
    mobile: null,
    mobileCountry: null,
    emailVerified: true,
    emailStatus: "ok",
    signupPersona: null,
    twoFactorEnabled: true,
    kycStatus: "approved",
    kycVerifiedAt: null,
    kycRetryCount: 0,
    deletionRequestedAt: null,
    securityStatusAvailable: true,
    suspendedReason: null,
    dateOfBirth: null,
    emailStatusChangedAt: null,
    pendingNewEmail: null,
    emailChangeExpiresAt: null,
    currentKycSessionId: null,
    amlHoldStatus: null,
    amlHoldReason: null,
    amlHoldAt: null,
    ...overrides,
  };
}

const tabs = [{ id: "overview", label: "Overview", content: <p>Overview content</p> }];

function shell(
  access: { canModerate: boolean; canManageRoles: boolean },
  user = client(),
  extra: Partial<Parameters<typeof PeopleDetailShell>[0]> = {},
) {
  return (
    <PeopleDetailShell
      user={user}
      listHref="/admin/clients"
      listLabel="Clients"
      access={access}
      tabs={tabs}
      {...extra}
    />
  );
}

describe("PeopleDetailShell header actions", () => {
  it("gives a moderator and role manager Change role and every account action, destructive last", async () => {
    render(shell({ canModerate: true, canManageRoles: true }));

    expect(screen.getByRole("button", { name: "Change role" })).toBeInTheDocument();
    expect(screen.queryByText(/view only/i)).toBeNull();
    // No fake primary action on a person's page.
    expect(screen.queryByRole("button", { name: /^(save|create|publish)/i })).toBeNull();

    const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
    expect(items).toEqual([
      "Copy user ID",
      "Copy email",
      "Reset two-step verification",
      "Suspend account",
    ]);
  });

  it("offers a moderator who cannot manage roles the account actions but not Change role", async () => {
    render(shell({ canModerate: true, canManageRoles: false }));

    expect(screen.queryByRole("button", { name: "Change role" })).toBeNull();
    expect(await screen.findByRole("menuitem", { name: "Suspend account" })).toBeInTheDocument();
  });

  it("shows a read-only viewer who they are with copy actions only", async () => {
    render(shell({ canModerate: false, canManageRoles: false }));

    expect(screen.getByText(/view only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /rename/i })).toBeNull();

    const items = (await screen.findAllByRole("menuitem")).map((item) => item.textContent);
    expect(items).toEqual(["Copy user ID", "Copy email"]);
  });

  it("offers Unsuspend, not Suspend, for a suspended account", async () => {
    render(
      shell(
        { canModerate: true, canManageRoles: false },
        client({ suspendedAt: "2026-04-01T00:00:00.000Z" }),
      ),
    );

    expect(await screen.findByRole("menuitem", { name: "Unsuspend account" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Suspend account" })).toBeNull();
  });

  it("opens the role dialog from Change role with Cancel focused", async () => {
    render(shell({ canModerate: false, canManageRoles: true }));

    fireEvent.click(screen.getByRole("button", { name: "Change role" }));
    expect(await screen.findByText("Change Ada Lovelace's role")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });
});

describe("PeopleDetailShell header facts", () => {
  it("says Not verified in words for identity, never the stored value", () => {
    render(
      shell(
        { canModerate: true, canManageRoles: true },
        client({ kycStatus: "unverified", emailVerified: false }),
      ),
    );

    const header = screen.getByRole("heading", { level: 1 }).closest("header") ?? document.body;
    expect(within(header).getByText("Not verified", { selector: "span span" })).toBeInTheDocument();
    // Email verification is said once, in Security and verification, not in the header.
    expect(screen.queryByText(/· Not verified/)).toBeNull();
    expect(screen.queryByText(/unverified/i)).toBeNull();
  });

  it("shows account standing and identity as the two badges", () => {
    render(shell({ canModerate: true, canManageRoles: true }));

    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
    // Two-step lives in Security and verification only.
    expect(screen.queryByText("Two-step")).toBeNull();
  });

  it("shows every role a staff member holds instead of an identity badge", () => {
    render(
      shell(
        { canModerate: true, canManageRoles: true },
        client({
          role: "staff",
          staffRole: "finance",
          staffRoles: ["finance", "fulfilment"],
          kycStatus: "unverified",
        }),
        { showContextRail: false },
      ),
    );

    expect(screen.getByText("Finance and Fulfilment")).toBeInTheDocument();
    expect(screen.queryByText("Not verified")).toBeNull();
  });

  it("lists what needs attention with where to fix it", () => {
    render(
      shell({ canModerate: true, canManageRoles: true }, client(), {
        attentionItems: [
          {
            id: "aml",
            message: "Watchlist screening awaiting review",
            href: "?tab=overview#aml",
            severity: "warning",
          },
        ],
      }),
    );

    expect(screen.getByText("Watchlist screening awaiting review")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review" })).toHaveAttribute(
      "href",
      "?tab=overview#aml",
    );
  });
});

describe("PeopleDetailShell sections", () => {
  it("shows tabs only when there is more than one section", () => {
    const { rerender } = render(shell({ canModerate: true, canManageRoles: true }));
    expect(screen.queryByRole("navigation", { name: "Client sections" })).toBeNull();

    rerender(
      <StaffTooltipProvider>
        {shell({ canModerate: true, canManageRoles: true }, client(), {
          tabs: [...tabs, { id: "bids", label: "Bids", content: <p>Bids content</p>, count: 4 }],
        })}
      </StaffTooltipProvider>,
    );
    const nav = screen.getByRole("navigation", { name: "Client sections" });
    expect(within(nav).getByRole("link", { name: /Bids/ })).toHaveAttribute(
      "href",
      "/admin/clients/user_1?tab=bids",
    );
  });
});
