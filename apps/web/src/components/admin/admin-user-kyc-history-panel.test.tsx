import type { AdminKycSessionRow } from "@/lib/data/http/admin.server";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserKycHistoryPanel } from "./admin-user-kyc-history-panel";

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
    <TooltipProvider>
      <AdminUserKycHistoryPanel sessions={sessions} currentKycSessionId={currentKycSessionId} />
    </TooltipProvider>,
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

    fireEvent.click(screen.getAllByRole("button", { name: "View details" })[0] as HTMLElement);
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
