import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import { queuePanel } from "@/test/queue-panel";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminUserKycHistoryPanel } from "./admin-user-kyc-history-panel";

const searchParams = vi.hoisted(() => ({ current: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams.current }));

function session(overrides: Partial<AdminKycSessionRow> = {}): AdminKycSessionRow {
  return {
    id: "kyc_1",
    provider: "veriff",
    providerSessionId: "veriff-session-1",
    providerAttemptId: null,
    status: "approved",
    verifiedFirstName: "Ada",
    verifiedLastName: "Lovelace",
    verifiedDateOfBirth: "1815-12-10",
    verifiedIdNumberLast4: "4321",
    verifiedIdCountry: "GB",
    verifiedIdType: "PASSPORT",
    verifiedIdExpiry: null,
    verifiedGender: null,
    verifiedNationality: "British",
    verifiedCitizenship: "British",
    verifiedPlaceOfBirth: null,
    verifiedYearOfBirth: null,
    verifiedIdNumber: null,
    verifiedDocState: null,
    verifiedIdValidFrom: null,
    decisionRiskScore: null,
    decisionIpCountry: null,
    decisionStatus: null,
    decisionReasonCode: null,
    decisionReasonLabel: null,
    createdAt: "2026-03-12T10:00:00.000Z",
    decisionAt: "2026-03-12T10:05:00.000Z",
    ...overrides,
  };
}

function panel(sessions: AdminKycSessionRow[], currentKycSessionId: string | null = null) {
  render(
    <StaffTooltipProvider>
      <AdminUserKycHistoryPanel sessions={sessions} currentKycSessionId={currentKycSessionId} />
    </StaffTooltipProvider>,
  );
}

describe("AdminUserKycHistoryPanel", () => {
  it("names each check's outcome in words and marks the current one", () => {
    panel(
      [
        session(),
        session({
          id: "kyc_2",
          providerSessionId: "veriff-session-2",
          status: "resubmission_requested",
        }),
      ],
      "veriff-session-1",
    );

    const table = screen.getByRole("grid", { name: "Identity checks" });
    expect(within(table).getByText("Approved")).toBeInTheDocument();
    expect(within(table).getByText("Resubmission requested")).toBeInTheDocument();
    expect(within(table).getByText("Current")).toBeInTheDocument();
    expect(screen.queryByText(/resubmission_requested/)).toBeNull();
  });

  it("keeps personal details out of the page until a check is opened", () => {
    panel([session()]);
    expect(screen.queryByText("Ada Lovelace")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0] as HTMLElement);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("PASSPORT GB ending 4321")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in Veriff" })).toHaveAttribute(
      "href",
      expect.stringContaining("/verifications/veriff-session-1"),
    );
  });

  it("says what will appear when there are no checks", () => {
    panel([]);
    expect(screen.getByText("No identity checks yet")).toBeInTheDocument();
  });
});

describe("AdminUserKycHistoryPanel identity check address", () => {
  const checks = [
    session({ id: "kyc_old", createdAt: "2026-01-01T10:00:00.000Z" }),
    session({ id: "kyc_new", createdAt: "2026-05-01T10:00:00.000Z", status: "declined" }),
    session({ id: "kyc_mid", createdAt: "2026-03-01T10:00:00.000Z", status: "expired" }),
  ];
  beforeEach(() => {
    window.history.replaceState(null, "", "/admin/clients/user_1");
    searchParams.current = new URLSearchParams();
  });
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("puts the open check in the page's address and steps newest first with J and K", () => {
    panel(checks);
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[1] as HTMLElement);
    expect(window.location.search).toBe("?identityCheck=kyc_mid");
    expect(queuePanel.position()).toBe("2 of 3");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "j" });
    expect(window.location.search).toBe("?identityCheck=kyc_old");
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "k" });
    expect(window.location.search).toBe("?identityCheck=kyc_new");
    expect(queuePanel.position()).toBe("1 of 3");
  });

  it("reopens the check from the address", () => {
    searchParams.current = new URLSearchParams("identityCheck=kyc_mid");
    panel(checks);
    expect(queuePanel.title("Identity check")).toBeVisible();
    expect(queuePanel.position()).toBe("2 of 3");
  });

  it("closes on Back, and Esc returns focus to the check's row", async () => {
    panel(checks);
    fireEvent.click(screen.getAllByRole("button", { name: "Details" })[0] as HTMLElement);
    act(() => window.history.back());
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    expect(window.location.search).toBe("");

    const details = screen.getAllByRole("button", { name: "Details" })[0] as HTMLElement;
    details.focus();
    fireEvent.click(details);
    fireEvent.keyDown(queuePanel.get() as HTMLElement, { key: "Escape" });
    await waitFor(() => expect(queuePanel.get()).not.toBeInTheDocument());
    await waitFor(() => expect(document.activeElement).toBe(details));
  });
});
