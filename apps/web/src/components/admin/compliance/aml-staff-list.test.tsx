import type { AmlStaffRow } from "@/lib/admin/compliance/aml-staff-list.vm";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmlStaffList, type AmlStaffListProps } from "./aml-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/compliance/aml",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/actions/compliance", () => ({
  amlTriageAction: vi.fn(),
  amlDecideAction: vi.fn(),
}));
vi.mock("@/lib/auth/step-up/use-step-up-coordinator", () => ({
  redirectToHostedReauth: vi.fn(),
}));

function screening(id: string, client: string, screenedAt: string): AmlStaffRow {
  return {
    id,
    userId: `user_${id}`,
    client,
    match: { label: "Potential match", tone: "warning" },
    decision: { label: "Pending review", tone: "warning" },
    monitor: { label: "Active", tone: "info" },
    categories: "Sanctions",
    totalHits: 1,
    screenedAt,
    checkType: null,
    providerSessionId: `sess_${id}`,
    triage: {
      label: "Awaiting triage",
      recommendation: null,
      byUserId: null,
      at: null,
      notes: null,
    },
    review: null,
    hits: [],
  };
}

// Shown oldest first, the queue's order.
const rows = [
  screening("scr_b", "Grace Hopper", "2026-10-15T10:00:00.000Z"),
  screening("scr_c", "Alan Turing", "2026-10-30T10:00:00.000Z"),
  screening("scr_a", "Ada Lovelace", "2026-10-01T10:00:00.000Z"),
];

const analyst = { canTriage: true, canDecide: false, currentUserId: "analyst_1" };

function renderList(overrides: Partial<AmlStaffListProps> = {}) {
  const props: AmlStaffListProps = {
    search: {},
    rows,
    selected: null,
    selectedId: null,
    summary: { total: 3 } as AmlStaffListProps["summary"],
    capabilities: analyst,
    attentionCounts: { manualReviewCount: 0, sourceOfFundsPending: 0, canOpenPayments: false },
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <AmlStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const panel = () => screen.queryByRole("dialog");
const heading = (name: string) =>
  within(panel() as HTMLElement).getByRole("heading", { name, level: 2 });
const position = () =>
  document.querySelector("[data-staff-queue-position]")?.textContent?.replace(/\s+/g, " ");

describe("AmlStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/compliance/aml");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("links each screening to its own address and offers Open client from the panel menu, not the header", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "Grace Hopper" })[0]).toHaveAttribute(
      "href",
      "/admin/compliance/aml?screening=scr_b",
    );
    fireEvent.click(screen.getAllByText("Grace Hopper")[0] as HTMLElement);
    expect(
      within(panel() as HTMLElement).queryByRole("link", { name: "Open full page" }),
    ).not.toBeInTheDocument();
    expect(
      within(panel() as HTMLElement).queryByRole("link", { name: "Open client" }),
    ).not.toBeInTheDocument();
    expect(queuePanel.openMenu().getByRole("menuitem", { name: "Open client" })).toHaveAttribute(
      "href",
      "/admin/clients/user_scr_b",
    );
  });

  it("keeps the URL in step as it opens and as J and K move through the queue", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Grace Hopper")[0] as HTMLElement);
    expect(window.location.search).toBe("?screening=scr_b");
    expect(position()).toMatch(/^2 of 3/);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    expect(heading("Alan Turing")).toBeVisible();
    expect(window.location.search).toBe("?screening=scr_c");
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    expect(heading("Ada Lovelace")).toBeVisible();
    expect(window.location.search).toBe("?screening=scr_a");
    expect(position()).toMatch(/^1 of 3/);
  });

  it("reopens a screening from its address, even one not on this page", () => {
    window.history.replaceState(null, "", "/admin/compliance/aml?screening=scr_z");
    const offPage = screening("scr_z", "Off Page", "2026-09-01T10:00:00.000Z");
    renderList({ search: { screening: "scr_z" }, selected: offPage, selectedId: "scr_z" });
    expect(heading("Off Page")).toBeVisible();
  });

  it("closes on Back and returns focus to the screening last shown on Escape", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("Ada Lovelace")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getAllByText("Ada Lovelace")[0] as HTMLElement);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement?.closest("tr")?.textContent).toContain("Grace Hopper"),
    );
  });

  it("offers an analyst the recommendation, through its confirmation", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Grace Hopper")[0] as HTMLElement);
    const dialog = panel() as HTMLElement;
    expect(within(dialog).queryByRole("button", { name: "Clear screening" })).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Recommend block" }));
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(1);
  });

  it("offers no review step to someone without either permission", () => {
    renderList({ capabilities: { canTriage: false, canDecide: false, currentUserId: "x" } });
    fireEvent.click(screen.getAllByText("Grace Hopper")[0] as HTMLElement);
    const dialog = panel() as HTMLElement;
    expect(within(dialog).queryByRole("button", { name: /^Recommend/ })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Clear screening" })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Block screening" })).toBeNull();
  });
});
