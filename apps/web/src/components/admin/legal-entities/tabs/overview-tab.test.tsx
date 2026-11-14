import type { AdminLegalEntityDetailBundle } from "@/lib/admin/load-admin-legal-entity-detail";
import { StaffTooltipProvider } from "@auction/staff-ui";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LegalEntityOverviewTab } from "./overview-tab";

vi.mock("next/link", async () => (await import("@/test/row-link")).nextLinkMock());
vi.mock("@/components/exports/export-button", () => ({ ExportButton: () => null }));

const entity = {
  id: "le_1",
  displayName: "Barnes Gallery",
  legalName: "Barnes Gallery Ltd",
  status: "connect_pending",
  kind: "organisation",
  subkind: "gallery",
  isLaxManaged: true,
  platformFeeBps: null,
  stripeConnectAccountId: "acct_123",
  stripeConnectPayoutsEnabled: false,
  stripeConnectRequirementsCurrentlyDue: ["external_account", "individual.dob.day"],
  stripeConnectRequirementsErrors: [],
  createdAt: new Date("2026-09-01T10:00:00.000Z"),
  updatedAt: new Date("2026-10-20T10:00:00.000Z"),
} as unknown as AdminLegalEntityDetailBundle["entity"];

const health = {
  stageLabel: "Connect onboarding",
  canPublish: false,
  canReceivePayouts: false,
  blockers: [
    {
      key: "stripe_requirements",
      label: "Stripe needs more information",
      hint: "Ask the organisation to finish Stripe onboarding.",
    },
  ],
  statusReason: null,
} as unknown as AdminLegalEntityDetailBundle["health"];

function renderOverview(patch: Partial<Parameters<typeof LegalEntityOverviewTab>[0]> = {}) {
  return render(
    <StaffTooltipProvider>
      <LegalEntityOverviewTab
        entity={entity}
        creator={{ id: "u_1", name: "Ada Lovelace", email: "ada@example.com" }}
        health={health}
        pendingDocCount={1}
        documentCount={3}
        {...patch}
      />
    </StaffTooltipProvider>,
  );
}

/** The value beside a label in a key-value list. */
function factValue(label: string): HTMLElement {
  const term = screen.getAllByText(label, { selector: "dt" })[0];
  const value = term?.nextElementSibling;
  if (!value) throw new Error(`No value for ${label}`);
  return value as HTMLElement;
}

describe("LegalEntityOverviewTab", () => {
  it("shows the readiness summary the list's panel used to show", () => {
    renderOverview();
    // Readiness: Connect stage, can sell, can get paid and what blocks it.
    expect(factValue("Connect stage")).toHaveTextContent("Connect onboarding");
    expect(factValue("Can sell")).toHaveTextContent("Not ready to sell");
    expect(factValue("Can get paid")).toHaveTextContent("Payout setup incomplete");
    expect(screen.getByText("Stripe needs more information")).toBeInTheDocument();
    expect(
      screen.getByText("Ask the organisation to finish Stripe onboarding."),
    ).toBeInTheDocument();
    // Stripe Connect and what Stripe still needs.
    expect(screen.getAllByText("Setup in progress").length).toBeGreaterThan(0);
    expect(screen.getByText("2 requirements due")).toBeInTheDocument();
    // Kind, LAX-managed, created by, documents, updated and the ID.
    expect(factValue("Kind")).toHaveTextContent("Organisation · Gallery");
    expect(factValue("Managed by LAX")).toHaveTextContent("Yes");
    expect(
      within(factValue("Created by")).getByRole("link", { name: "Ada Lovelace" }),
    ).toHaveAttribute("href", "/admin/clients/u_1");
    expect(factValue("Documents")).toHaveTextContent("3 on file · 1 pending review");
    expect(factValue("Updated")).not.toBeEmptyDOMElement();
    expect(factValue("Legal entity ID")).toHaveTextContent("le_1");
  });

  it("says when nothing blocks the entity and no documents are on file", () => {
    renderOverview({
      health: {
        ...health,
        canPublish: true,
        canReceivePayouts: true,
        blockers: [],
      } as AdminLegalEntityDetailBundle["health"],
      pendingDocCount: 0,
      documentCount: 0,
    });
    expect(factValue("Can sell")).toHaveTextContent("Ready to publish lots");
    expect(factValue("Can get paid")).toHaveTextContent("Payouts enabled");
    expect(screen.getByText(/No outstanding blockers/)).toBeInTheDocument();
    expect(factValue("Documents")).toHaveTextContent("None uploaded");
  });

  it("leaves documents out for a viewer who may not see them", () => {
    renderOverview({ documentCount: null });
    expect(screen.queryByText("Documents", { selector: "dt" })).not.toBeInTheDocument();
  });
});
