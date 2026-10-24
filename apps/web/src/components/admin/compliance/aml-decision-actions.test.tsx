import type { AmlStaffRow } from "@/lib/admin/compliance/aml-staff-list.vm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAmlDecisionActions } from "./aml-decision-actions";

const refresh = vi.fn();
const triageAction = vi.fn();
const decideAction = vi.fn();
const notifySuccess = vi.fn();

// Radix's dialog portals, traps focus and animates, which is slow and noisy in jsdom. This
// stand-in keeps the open/close contract so the tests cover what the dialogs ask and do.
vi.mock("@auction/ui/components/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <dialog open>{children}</dialog> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/compliance", () => ({
  amlTriageAction: (...args: unknown[]) => triageAction(...args),
  amlDecideAction: (...args: unknown[]) => decideAction(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (title: string) => notifySuccess(title), error: vi.fn() },
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

const NOTE = "Same name and date of birth as the listed person";

const screening: AmlStaffRow = {
  id: "scr_1",
  userId: "user_1",
  client: "Ada Lovelace",
  match: { label: "Potential match", tone: "warning" },
  decision: { label: "Pending review", tone: "warning" },
  monitor: { label: "Active", tone: "info" },
  categories: "Sanctions",
  totalHits: 1,
  screenedAt: "2026-10-20T10:00:00.000Z",
  checkType: null,
  providerSessionId: "sess_1",
  triage: { label: "Awaiting triage", recommendation: null, byUserId: null, at: null, notes: null },
  review: null,
  hits: [],
};

const triaged: AmlStaffRow = {
  ...screening,
  triage: {
    label: "Recommended block",
    recommendation: "block",
    byUserId: "analyst_1",
    at: "2026-10-21T09:00:00.000Z",
    notes: null,
  },
};

type Caps = { canTriage: boolean; canDecide: boolean; currentUserId: string };
const mlro: Caps = { canTriage: true, canDecide: true, currentUserId: "mlro_1" };

function Harness({ row, caps = mlro }: { row: AmlStaffRow; caps?: Caps }) {
  const aml = useAmlDecisionActions(caps);
  return (
    <>
      <ul>
        {aml.actionsFor(row).map((action) => (
          <li key={action.id}>
            <button
              type="button"
              disabled={Boolean(action.disabledReason)}
              title={action.disabledReason}
              onClick={() => action.onSelect?.()}
            >
              {action.label}
            </button>
          </li>
        ))}
      </ul>
      {aml.dialogs}
    </>
  );
}

describe("useAmlDecisionActions", () => {
  beforeEach(() => {
    for (const fn of [refresh, triageAction, decideAction, notifySuccess]) fn.mockReset();
  });

  it("offers an untriaged screening to the analyst, with the decision held back", () => {
    render(<Harness row={screening} />);
    expect(screen.getByRole("button", { name: "Recommend clear" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Recommend block" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Clear screening" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Block screening" })).toHaveAttribute(
      "title",
      "An analyst must record a triage before the MLRO can decide.",
    );
  });

  it("offers nothing to a role with neither permission", () => {
    render(
      <Harness
        row={screening}
        caps={{ canTriage: false, canDecide: false, currentUserId: "mlro_1" }}
      />,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("records a triage recommendation with an optional note", async () => {
    triageAction.mockResolvedValue({ ok: true });
    render(<Harness row={screening} />);
    fireEvent.click(screen.getByRole("button", { name: "Recommend block" }));

    expect(
      screen.getByRole("heading", { name: "Recommend blocking Ada Lovelace?" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Notes/), { target: { value: NOTE } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Recommend block" }).at(-1) as HTMLElement,
    );
    await waitFor(() =>
      expect(triageAction).toHaveBeenCalledWith({
        screeningId: "scr_1",
        recommendation: "block",
        notes: NOTE,
      }),
    );
    await waitFor(() =>
      expect(notifySuccess).toHaveBeenCalledWith("Triage recorded: recommend block"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("lets a triage go through without a note", async () => {
    triageAction.mockResolvedValue({ ok: true });
    render(<Harness row={screening} />);
    fireEvent.click(screen.getByRole("button", { name: "Recommend clear" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Recommend clear" }).at(-1) as HTMLElement,
    );
    await waitFor(() =>
      expect(triageAction).toHaveBeenCalledWith({
        screeningId: "scr_1",
        recommendation: "clear",
        notes: undefined,
      }),
    );
  });

  it("lets a different MLRO make the binding decision once there is a triage", async () => {
    decideAction.mockResolvedValue({ ok: true });
    render(<Harness row={triaged} />);
    expect(screen.queryByRole("button", { name: "Recommend clear" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Block screening" }));

    expect(screen.getByRole("heading", { name: "Block Ada Lovelace?" })).toBeInTheDocument();
    expect(screen.getByText(/Blocking is terminal/)).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: "Block screening" }).at(-1) as HTMLElement,
    );
    await waitFor(() =>
      expect(decideAction).toHaveBeenCalledWith({
        screeningId: "scr_1",
        decision: "block",
        notes: undefined,
      }),
    );
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith("Screening blocked"));
  });

  it("keeps the analyst who triaged from also deciding", () => {
    render(<Harness row={triaged} caps={{ ...mlro, currentUserId: "analyst_1" }} />);
    expect(screen.getByRole("button", { name: "Clear screening" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear screening" })).toHaveAttribute(
      "title",
      expect.stringMatching(/different MLRO/),
    );
  });

  it("keeps the dialog open with the note when the decision fails", async () => {
    decideAction.mockResolvedValue({ ok: false, error: "The screening was already decided." });
    render(<Harness row={triaged} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear screening" }));
    fireEvent.change(screen.getByLabelText(/Decision notes/), { target: { value: NOTE } });
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear screening" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByText("The screening was already decided.")).toBeInTheDocument();
    expect(screen.getByLabelText(/Decision notes/)).toHaveValue(NOTE);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in when the API requires one", async () => {
    decideAction.mockResolvedValue({
      ok: false,
      error: "Recent sign-in required",
      errorCode: "step_up_required",
    });
    render(<Harness row={triaged} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear screening" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear screening" }).at(-1) as HTMLElement,
    );
    expect(await screen.findByRole("heading", { name: "Confirm it’s you" })).toBeInTheDocument();
  });
});
