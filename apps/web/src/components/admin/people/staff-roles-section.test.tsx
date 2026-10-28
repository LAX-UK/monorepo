import type { LaxAdminRolesOverview, StaffRolesOverview } from "@/lib/data/http/staff-roles.server";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LaxAdminRolesSection, StaffRolesSection } from "./staff-roles-section";

const { refresh, assignAction, removeAction, laxAssignAction, laxRemoveAction, notifySuccess } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    assignAction: vi.fn(),
    removeAction: vi.fn(),
    laxAssignAction: vi.fn(),
    laxRemoveAction: vi.fn(),
    notifySuccess: vi.fn(),
  }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/admin/admin-staff-roles", () => ({
  adminAssignStaffRoleAction: (...args: unknown[]) => assignAction(...args),
  adminRemoveStaffRoleAction: (...args: unknown[]) => removeAction(...args),
  adminAssignLaxAdminRoleAction: (...args: unknown[]) => laxAssignAction(...args),
  adminRemoveLaxAdminRoleAction: (...args: unknown[]) => laxRemoveAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: notifySuccess, error: vi.fn() } }));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({ redirectToHostedReauth: vi.fn() }));

// The kit's select positions its list slowly in jsdom; this stand-in keeps its choose contract.
vi.mock("@auction/staff-ui", async (importOriginal) => {
  const kit = await importOriginal<typeof import("@auction/staff-ui")>();
  return {
    ...kit,
    EnumSelect: ({
      options,
      onValueChange,
    }: {
      options: readonly { value: string; label: string; description?: string }[];
      onValueChange: (value: string) => void;
    }) => {
      const field = kit.useStaffField();
      return (
        <div id={field?.controlId}>
          {options.map((option) => (
            <button key={option.value} type="button" onClick={() => onValueChange(option.value)}>
              {option.label} {option.description}
            </button>
          ))}
        </div>
      );
    },
  };
});

const NOW = "2026-10-28T12:00:00.000Z";
const person = { id: "user_1", name: "Grace Hopper" };

function overview(
  roles: string[],
  otherActiveAdministrators = 1,
  endsAt: string | null = null,
): StaffRolesOverview {
  return {
    userId: "user_1",
    otherActiveAdministrators,
    assignments: roles.map((role) => ({
      id: `asg-${role}`,
      role: role as StaffRolesOverview["assignments"][number]["role"],
      startsAt: "2026-10-03T09:00:00.000Z",
      endsAt,
      grantedAt: "2026-10-03T09:00:00.000Z",
      reason: null,
    })),
  };
}

const manager = { can: () => true, roleLabel: "Administrator" };
const readOnly = { can: () => false, roleLabel: "Read-only" };

function renderSection(data: StaffRolesOverview | null, access = manager) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={access}>
        <StaffRolesSection person={person} overview={data} nowIso={NOW} />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

function chooseRole(label: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label} `) }));
}

describe("StaffRolesSection", () => {
  beforeEach(() => {
    for (const fn of [refresh, assignAction, removeAction, notifySuccess]) fn.mockReset();
  });

  it("shows each role as a chip with since when and until when", () => {
    renderSection(overview(["finance"], 1, "2026-11-10T00:00:00.000Z"));
    const roles = screen.getByRole("list", { name: "Grace Hopper's roles" });
    expect(within(roles).getByText("Finance")).toBeInTheDocument();
    expect(
      within(roles).getByText("Since 3 Oct 2026 · Until 9 Nov 2026 · 13 days left"),
    ).toBeVisible();
  });

  it("shows read-only viewers the roles without any controls", () => {
    renderSection(overview(["finance"]), readOnly);
    expect(screen.getByText("Finance")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("says when someone holds no role", () => {
    renderSection(overview([]));
    expect(screen.getByText(/No Bid roles/)).toBeInTheDocument();
  });

  it("explains a forbidden combination as soon as the role is chosen, and does not save", async () => {
    renderSection(overview(["finance"]));
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    chooseRole("Compliance");
    const message =
      "Compliance can't be combined with Finance. Moving money and clearing compliance checks are kept with different people.";
    expect(await screen.findByText(message)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Add role" }).at(-1) as HTMLElement);
    expect(await screen.findAllByText(message)).toHaveLength(2);
    expect(assignAction).not.toHaveBeenCalled();
  });

  it("gives a role with its last day and reason", async () => {
    assignAction.mockResolvedValue({ ok: true });
    renderSection(overview(["cataloguer"]));
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    chooseRole("Fulfilment");
    fireEvent.change(screen.getByLabelText(/Last day/), { target: { value: "30 Nov 2026" } });
    fireEvent.change(screen.getByLabelText("Reason"), {
      target: { value: "Cover for the winter sale" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Add role" }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(assignAction).toHaveBeenCalledWith("user_1", {
        role: "fulfilment",
        endsAt: "2026-12-01T00:00:00.000Z",
        reason: "Cover for the winter sale",
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith("Fulfilment role given to Grace Hopper");
    expect(refresh).toHaveBeenCalled();
  });

  it("asks for a role and a reason before saving", async () => {
    renderSection(overview([]));
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Add role" }).at(-1) as HTMLElement);
    expect(await screen.findAllByText("Choose a role.")).toHaveLength(2);
    expect(screen.getAllByText("Give a reason of at least 3 characters.")).toHaveLength(2);
    expect(assignAction).not.toHaveBeenCalled();
  });

  it("keeps the last administrator's role, with the reason shown", () => {
    renderSection(overview(["administrator"], 0));
    const remove = screen.getByRole("button", { name: "Remove the Administrator role" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(remove);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText(/Grace Hopper is the only administrator, so the role stays/),
    ).toBeInTheDocument();
  });

  it("asks before removing a role, with a reason", async () => {
    removeAction.mockResolvedValue({ ok: true });
    renderSection(overview(["finance", "fulfilment"]));
    fireEvent.click(screen.getByRole("button", { name: "Remove the Fulfilment role" }));
    expect(
      await screen.findByText("Remove the Fulfilment role from Grace Hopper?"),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Moved to finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove role" }));
    await waitFor(() =>
      expect(removeAction).toHaveBeenCalledWith("user_1", {
        role: "fulfilment",
        reason: "Moved to finance",
      }),
    );
  });
});

function laxOverview(
  roles: { role: string; pending?: "assign" | "remove" | null }[],
  otherActiveAdministrators = 1,
): LaxAdminRolesOverview {
  return {
    userId: "user_1",
    otherActiveAdministrators,
    assignments: roles.map(({ role, pending = null }) => ({
      id: `lax-${role}`,
      role: role as LaxAdminRolesOverview["assignments"][number]["role"],
      startsAt: "2026-10-03T09:00:00.000Z",
      endsAt: null,
      grantedAt: "2026-10-03T09:00:00.000Z",
      reason: null,
      pending,
    })),
  };
}

function renderLax(data: LaxAdminRolesOverview | null, access = manager) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={access}>
        <LaxAdminRolesSection person={person} overview={data} nowIso={NOW} />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

describe("LaxAdminRolesSection", () => {
  beforeEach(() => {
    for (const fn of [refresh, laxAssignAction, laxRemoveAction, notifySuccess]) fn.mockReset();
  });

  it("says when someone holds no LAX Admin role", () => {
    renderLax(laxOverview([]));
    expect(
      screen.getByText("No LAX Admin roles. Grace Hopper cannot sign in to LAX Admin."),
    ).toBeVisible();
  });

  it("shows several roles, with a change LAX Admin has not applied yet as waiting", () => {
    renderLax(laxOverview([{ role: "catalogue_editor" }, { role: "editor", pending: "assign" }]));
    const roles = screen.getByRole("list", { name: "Grace Hopper's LAX Admin roles" });
    expect(within(roles).getByText("Catalogue editor")).toBeInTheDocument();
    expect(within(roles).getByText("Waiting for LAX Admin to add it")).toBeVisible();
    expect(screen.getByRole("button", { name: "Remove the Editor role" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("explains a LAX Admin forbidden combination as soon as the role is chosen", async () => {
    renderLax(laxOverview([{ role: "broker" }]));
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    chooseRole("Finance");
    expect(
      await screen.findByText(
        "Finance can't be combined with Broker. Moving money and selling to clients are kept with different people.",
      ),
    ).toBeInTheDocument();
    expect(laxAssignAction).not.toHaveBeenCalled();
  });

  it("asks LAX Admin for the role and says it is waiting", async () => {
    laxAssignAction.mockResolvedValue({ ok: true });
    renderLax(laxOverview([{ role: "catalogue_editor" }]));
    fireEvent.click(screen.getByRole("button", { name: "Add role" }));
    chooseRole("Editor");
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Autumn exhibitions" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Add role" }).at(-1) as HTMLElement);
    await waitFor(() =>
      expect(laxAssignAction).toHaveBeenCalledWith("user_1", {
        role: "editor",
        endsAt: null,
        reason: "Autumn exhibitions",
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith("Editor role requested for Grace Hopper", {
      description: "It shows as waiting until LAX Admin applies it, usually within a minute.",
    });
  });

  it("keeps the last LAX Admin Administrator, and shows read-only viewers no controls", () => {
    renderLax(laxOverview([{ role: "shop_admin" }], 0));
    expect(screen.getByRole("button", { name: "Remove the Administrator role" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText(/is the only LAX Admin administrator/)).toBeInTheDocument();
  });

  it("shows read-only viewers the roles without any controls", () => {
    renderLax(laxOverview([{ role: "editor" }]), readOnly);
    expect(screen.getByText("Editor")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add role" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });
});
