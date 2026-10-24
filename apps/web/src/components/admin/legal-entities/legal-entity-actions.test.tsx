import type { LegalEntitiesStaffRow } from "@/lib/admin/people/legal-entities-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLegalEntityActions } from "./legal-entity-actions";

const push = vi.fn();
const refresh = vi.fn();
const impersonate = vi.fn();
const notifySuccess = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests cover what the dialog asks and does.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/legal-entity/acting-context.actions", () => ({
  startAdminImpersonationAfterLookup: (...args: unknown[]) => impersonate(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const entity: LegalEntitiesStaffRow = {
  id: "le_1",
  name: "Gallery One",
  kind: "Organisation · Gallery",
  status: "approved",
  statusPresentation: { label: "Approved", tone: "success" },
  stripeDueCount: 0,
  stripe: null,
  updatedAt: "2026-10-20T10:00:00.000Z",
};

function Harness() {
  const actions = useLegalEntityActions();
  return (
    <>
      {actions.actionsFor(entity).map((action) => (
        <button key={action.id} type="button" onClick={() => action.onSelect?.()}>
          {action.label}
        </button>
      ))}
      {actions.dialogs}
    </>
  );
}

describe("useLegalEntityActions", () => {
  beforeEach(() => {
    for (const fn of [push, refresh, impersonate, notifySuccess]) fn.mockReset();
  });

  it("confirms impersonation by naming the entity, then starts it", async () => {
    impersonate.mockResolvedValue({ ok: true });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Impersonate Gallery One" }));

    expect(screen.getByRole("heading", { name: "Impersonate Gallery One?" })).toBeInTheDocument();
    expect(impersonate).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Impersonate Gallery One" }).at(-1) as HTMLElement,
    );

    await waitFor(() => expect(impersonate).toHaveBeenCalledWith("le_1"));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Impersonating Gallery One"));
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("keeps the dialog open and says why when impersonation does not start", async () => {
    impersonate.mockResolvedValue({ ok: false, error: "forbidden", message: "HTTP 403" });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Impersonate Gallery One" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Impersonate Gallery One" }).at(-1) as HTMLElement,
    );

    expect(
      await screen.findByText("You do not have permission to impersonate legal entities."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Impersonate Gallery One?" })).toBeInTheDocument();
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    impersonate.mockResolvedValue({ ok: false, error: "step_up_required" });
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Impersonate Gallery One" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Impersonate Gallery One" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });
});
