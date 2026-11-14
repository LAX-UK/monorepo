import type { OnboardingStaffRow } from "@/lib/admin/onboarding-issues-staff-list.vm";
import { onboardingNextStep } from "@/lib/admin/onboarding-issues-staff-list.vm";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OnboardingIssuesStaffList,
  type OnboardingIssuesStaffListProps,
} from "./onboarding-issues-staff-list";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/onboarding-issues",
  useSearchParams: () => new URLSearchParams(),
}));

function item(
  id: string,
  title: string,
  since: string,
  status = "requires_input",
): OnboardingStaffRow {
  return {
    id,
    tab: "kyc",
    kind: "KYC session",
    title,
    secondary: "Stripe Identity",
    email: `${id}@example.test`,
    status: { label: "Requires input", tone: "warning" },
    since,
    ageLabel: "3d ago",
    urgency: "attention",
    href: `/admin/clients/user_${id}`,
    hrefLabel: "Open client",
    nextStep: onboardingNextStep("kyc", status),
  };
}

// Shown longest waiting first, the queue's order.
const rows = [
  item("kyc_b", "Grace Hopper", "2026-10-15T10:00:00.000Z"),
  item("kyc_c", "Alan Turing", "2026-10-20T10:00:00.000Z", "processing"),
  item("kyc_a", "Ada Lovelace", "2026-10-01T10:00:00.000Z"),
];

function renderList(overrides: Partial<OnboardingIssuesStaffListProps> = {}) {
  const props: OnboardingIssuesStaffListProps = {
    search: { tab: "kyc" },
    tab: "kyc",
    rows,
    selected: null,
    selectedId: null,
    previewDegraded: false,
    queueSummary: { queueTotal: 120 } as OnboardingIssuesStaffListProps["queueSummary"],
    lensSummary: null,
    offset: 50,
    total: 120,
    pageSize: 50,
    pagination: null,
    loadError: null,
    ...overrides,
  };
  return render(
    <StaffTooltipProvider>
      <OnboardingIssuesStaffList {...props} />
    </StaffTooltipProvider>,
  );
}

const panel = () => screen.queryByRole("dialog");
const heading = (name: string) =>
  within(panel() as HTMLElement).getByRole("heading", { name, level: 2 });
const position = () =>
  document.querySelector("[data-staff-queue-position]")?.textContent?.replace(/\s+/g, " ");

describe("OnboardingIssuesStaffList queue panel", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/onboarding-issues?tab=kyc&offset=50");
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("shows what holds the item up, who it waits on and the next step", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Alan Turing")[0] as HTMLElement);
    const dialog = panel() as HTMLElement;
    expect(within(dialog).getByText("No result from the provider")).toBeVisible();
    expect(within(dialog).getByText("The provider")).toBeVisible();
    expect(within(dialog).getByRole("heading", { name: "Next step" })).toBeVisible();
    expect(within(dialog).getByText(/Check the session with the provider/)).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Open full page" })).toHaveAttribute(
      "href",
      "/admin/clients/user_kyc_c",
    );
    // One route only: the footer has no second "Open client" button.
    expect(within(dialog).queryByRole("link", { name: "Open client" })).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("link", { name: /open/i })).toHaveLength(1);
    expect(within(dialog).getByText("kyc_c@example.test")).toBeVisible();
  });

  it("keeps the item in the URL, its place in the whole queue, and steps with J and K", () => {
    renderList();
    fireEvent.click(screen.getAllByText("Grace Hopper")[0] as HTMLElement);
    expect(window.location.search).toBe("?tab=kyc&offset=50&item=kyc_b");
    expect(position()).toMatch(/^52 of 120/);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    expect(heading("Alan Turing")).toBeVisible();
    expect(window.location.search).toBe("?tab=kyc&offset=50&item=kyc_c");
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "k" });
    expect(heading("Ada Lovelace")).toBeVisible();
    expect(position()).toMatch(/^51 of 120/);
  });

  it("reopens an item from its address, even one the server loaded off this page", () => {
    const offPage = item("kyc_z", "Off Page", "2026-09-01T10:00:00.000Z");
    renderList({ selected: offPage, selectedId: "kyc_z" });
    expect(heading("Off Page")).toBeVisible();
  });

  it("closes on Back and returns focus to the item last shown on Escape", async () => {
    renderList();
    fireEvent.click(screen.getAllByText("Ada Lovelace")[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    expect(window.location.search).toBe("?tab=kyc&offset=50");

    fireEvent.click(screen.getAllByText("Ada Lovelace")[0] as HTMLElement);
    fireEvent.keyDown(panel() as HTMLElement, { key: "j" });
    fireEvent.keyDown(panel() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(panel()).not.toBeInTheDocument());
    await waitFor(() =>
      expect(document.activeElement?.closest("tr")?.textContent).toContain("Grace Hopper"),
    );
  });

  it("links each row to the record page that settles it", () => {
    renderList();
    expect(screen.getAllByRole("link", { name: "Grace Hopper" })[0]).toHaveAttribute(
      "href",
      "/admin/clients/user_kyc_b",
    );
  });
});
