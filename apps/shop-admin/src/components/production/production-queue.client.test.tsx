// @vitest-environment jsdom
import type { AdminProductionTaskList } from "@auction/shop-contracts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateProductionTask = vi.fn();
const refresh = vi.fn();

vi.mock("@/server/application/admin-production-actions.server", () => ({
  updateProductionTask,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/production",
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/dropdown-menu", async () =>
  (await import("@/test/radix-stubs")).dropdownMenuStub(),
);
vi.mock("@auction/ui/components/select", async () =>
  (await import("@/test/radix-stubs")).selectStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { ProductionQueue } = await import("./production-queue.client");
const { productionList } = await import("@/server/domain/sales-lists.vm");

const ME = { subject: "me-subject", label: "Pat Jones", role: "operations" };
const TASK_ID = "11111111-1111-4111-8111-111111111111";

const page: AdminProductionTaskList = {
  items: [
    {
      taskId: TASK_ID,
      orderId: "abcdef12-0000-4000-8000-000000000000",
      orderLineId: "22222222-2222-4222-8222-222222222222",
      editionId: "33333333-3333-4333-8333-333333333333",
      artworkTitle: "Dusk",
      editionNumber: 4,
      status: "queued",
      assignee: null,
      version: 7,
      createdAt: "2026-10-20T09:00:00.000Z",
      updatedAt: "2026-10-20T09:00:00.000Z",
    },
  ],
  nextCursor: null,
  counts: { queued: 1 },
};

function renderQueue(query: Record<string, string> = {}) {
  render(
    <ProductionQueue
      state={productionList.parse(query)}
      page={page}
      assignees={[ME]}
      currentSubject={ME.subject}
    />,
  );
}

const rowMenuItem = (name: RegExp) => {
  const row = within(screen.getByRole("grid")).getByText("Dusk (edition 4)").closest("tr");
  return within(row as HTMLElement).getByRole("menuitem", { name });
};

beforeEach(() => {
  updateProductionTask.mockReset();
  refresh.mockReset();
  updateProductionTask.mockResolvedValue({ ok: true, data: { version: 8, status: "printing" } });
});

describe("the production queue", () => {
  it("moves a task on from its row against the version on screen", async () => {
    renderQueue();
    fireEvent.click(rowMenuItem(/Start printing/));
    await waitFor(() =>
      expect(updateProductionTask).toHaveBeenCalledWith({
        id: TASK_ID,
        expectedVersion: 7,
        status: "printing",
      }),
    );
  });

  it("assigns a task to the person working the queue", async () => {
    renderQueue();
    fireEvent.click(rowMenuItem(/Assign to me/));
    await waitFor(() =>
      expect(updateProductionTask).toHaveBeenCalledWith({
        id: TASK_ID,
        expectedVersion: 7,
        assigneeSubject: ME.subject,
      }),
    );
  });

  it("asks before cancelling, starting on Keep task", async () => {
    renderQueue();
    fireEvent.click(rowMenuItem(/Cancel task/));
    const dialog = await screen.findByRole("dialog", { name: "Cancel Dusk (edition 4)?" });
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Keep task" })).toHaveFocus(),
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel task" }));
    await waitFor(() =>
      expect(updateProductionTask).toHaveBeenCalledWith(
        expect.objectContaining({ status: "cancelled" }),
      ),
    );
  });

  it("says the task changed when someone else moved it, and reloads on request", async () => {
    updateProductionTask.mockResolvedValue({ ok: false, kind: "conflict", message: "Stale" });
    renderQueue();
    fireEvent.click(rowMenuItem(/Start printing/));
    const dialog = await screen.findByRole("dialog", { name: "This task changed" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("opens the task's panel from the URL with its next move as the primary action", async () => {
    renderQueue({ task: TASK_ID });
    const panel = await screen.findByRole("dialog", { name: /Dusk \(edition 4\)/ });
    expect(within(panel).getByRole("button", { name: "Start printing" })).toBeInTheDocument();
    expect(within(panel).getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      `/production/${TASK_ID}`,
    );
  });
});
