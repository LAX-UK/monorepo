import {
  ASSIGNEES,
  inProgressProblem,
  openProblem,
  resolvedProblem,
} from "@/lib/admin/purchase-problems/purchase-problem.fixture";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PurchaseProblemView, type PurchaseProblemViewProps } from "./purchase-problem-view";

const refresh = vi.fn();
const update = vi.fn();
const notifySuccess = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/purchase-problems/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/admin/admin-purchase-problems", () => ({
  updatePurchaseProblemAction: (...args: unknown[]) => update(...args),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: { success: (...args: unknown[]) => notifySuccess(...args), error: vi.fn() },
}));

const ALL_LINKS = { payment: true, lot: true, fulfilment: true };

function renderView(props: Partial<PurchaseProblemViewProps> = {}) {
  return render(
    <StaffTooltipProvider>
      <PurchaseProblemView
        problem={openProblem}
        assignees={ASSIGNEES}
        viewerId="u-sofia"
        links={ALL_LINKS}
        {...props}
      />
    </StaffTooltipProvider>,
  );
}

const saved = (patch: object = {}) => ({
  ok: true,
  data: { ...openProblem, version: openProblem.version + 1, ...patch },
});

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  update.mockResolvedValue(saved());
});

describe("PurchaseProblemView: an open report", () => {
  it("shows what the buyer reported, the purchase and who owns it", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "Ada Lovelace · Damaged" })).toBeTruthy();
    expect(screen.getByText(/arrived cracked along the left edge/)).toBeTruthy();
    expect(screen.getByText("Nobody yet")).toBeTruthy();
    expect(screen.getByText("£4,800.50")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Paid" }).getAttribute("href")).toBe(
      "/admin/payments?payment=pay-1",
    );
    expect(screen.getByRole("link", { name: /Lot 12/ }).getAttribute("href")).toBe(
      "/admin/lots/lot-12",
    );
  });

  it("links to the payment and fulfilment pages only for people who can open them", () => {
    renderView({ links: { payment: false, lot: false, fulfilment: false } });
    expect(screen.queryByRole("link", { name: "Paid" })).toBeNull();
    expect(screen.getByText("Paid")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open the payment" })).toBeNull();
    expect(screen.queryByText("Put it right")).toBeNull();
  });

  it("points to the payment for a refund without moving any money itself", () => {
    renderView();
    expect(screen.getByRole("link", { name: "Open the payment" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open lot fulfilment" })).toBeTruthy();
  });

  it("takes the report on, and makes it the person's own when nobody has it", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Take on" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(openProblem.id, {
        status: "in_progress",
        assignedToUserId: "u-sofia",
        version: 1,
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith("PR-3F2A9C1E is in progress");
    expect(refresh).toHaveBeenCalled();
  });

  it("keeps the owner when a colleague already has it", async () => {
    renderView({ problem: { ...openProblem, assignedToUserId: "u-tom" } });
    fireEvent.click(screen.getByRole("button", { name: "Take on" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(openProblem.id, {
        status: "in_progress",
        version: 1,
      }),
    );
  });
});

describe("PurchaseProblemView: resolving", () => {
  it("will not resolve without a note, and says so beside the box", async () => {
    renderView({ problem: inProgressProblem });
    fireEvent.click(screen.getByRole("button", { name: "Resolve…" }));
    const dialog = await screen.findByRole("dialog", { name: "Resolve PR-3F2A9C1E" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolve report" }));
    expect(await within(dialog).findByText("Say what was done to resolve this.")).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("resolves with the note and confirms", async () => {
    renderView({ problem: inProgressProblem });
    fireEvent.click(screen.getByRole("button", { name: "Resolve…" }));
    const dialog = await screen.findByRole("dialog", { name: "Resolve PR-3F2A9C1E" });
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "  Refunded in full.  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolve report" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(openProblem.id, {
        status: "resolved",
        note: "Refunded in full.",
        version: 3,
      }),
    );
    expect(notifySuccess).toHaveBeenCalledWith("PR-3F2A9C1E resolved");
  });

  it("offers a reload when someone else changed the report, and keeps what was typed", async () => {
    update.mockResolvedValue({
      ok: false,
      error: "This report changed while you were editing it.",
      errorCode: "stale_version",
    });
    renderView({ problem: inProgressProblem });
    fireEvent.click(screen.getByRole("button", { name: "Resolve…" }));
    const dialog = await screen.findByRole("dialog", { name: "Resolve PR-3F2A9C1E" });
    fireEvent.change(within(dialog).getByRole("textbox"), { target: { value: "Done." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Resolve report" }));
    expect(await within(dialog).findByText("This report changed")).toBeTruthy();
    expect((within(dialog).getByRole("textbox") as HTMLTextAreaElement).value).toBe("Done.");
  });
});

describe("PurchaseProblemView: a resolved report", () => {
  it("shows the outcome, offers no status change and still takes notes", () => {
    renderView({ problem: resolvedProblem });
    expect(screen.getByText("Refunded in full and arranged a courier collection.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Take on" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Resolve…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reassign" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add note" })).toBeTruthy();
    expect(screen.queryByText("Put it right")).toBeNull();
  });
});

describe("PurchaseProblemView: notes and assignment", () => {
  it("adds a note", async () => {
    renderView({ problem: inProgressProblem });
    fireEvent.change(screen.getByRole("textbox", { name: /Add a note/ }), {
      target: { value: "Buyer sent photos." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(openProblem.id, {
        note: "Buyer sent photos.",
        version: 3,
      }),
    );
  });

  it("hands the report to a colleague", async () => {
    renderView({ problem: inProgressProblem });
    fireEvent.click(screen.getByRole("button", { name: "Reassign" }));
    const dialog = await screen.findByRole("dialog", { name: "Assign PR-3F2A9C1E" });
    expect(within(dialog).getByRole("button", { name: "Assign" })).toBeTruthy();
  });
});
