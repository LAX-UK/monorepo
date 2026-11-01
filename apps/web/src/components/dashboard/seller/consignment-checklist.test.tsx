import { checklistItemView } from "@/lib/seller/consignment-checklist-copy";
import { type ConsignmentChecklistFacts, computeConsignmentChecklist } from "@auction/domain";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConsignmentChecklist } from "./consignment-checklist";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderChecklist(
  facts: Partial<ConsignmentChecklistFacts>,
  ctx: { accountKind: "personal" | "organisation"; organisationName: string | null } = {
    accountKind: "personal",
    organisationName: null,
  },
) {
  const list = computeConsignmentChecklist({
    submissionStatus: "approved",
    lotStatus: null,
    accountKind: ctx.accountKind,
    identity: "required",
    agreement: { proposed: true, accepted: false },
    payoutsReady: false,
    viewer: { canAcceptAgreement: true, canSetUpPayouts: true },
    saleStartsAt: null,
    ...facts,
  });
  render(
    <ConsignmentChecklist
      items={list.items.map((item) =>
        checklistItemView(item, { ...ctx, agreementHref: "#agreement" }),
      )}
      doneCount={list.doneCount}
      totalCount={list.totalCount}
    />,
  );
}

describe("ConsignmentChecklist", () => {
  it("shows every item to do with why, by when and one button each", () => {
    renderChecklist({});
    expect(screen.getByRole("heading", { name: "Before your work can go to sale" })).toBeVisible();
    expect(screen.getByText("0 of 3 done")).toBeVisible();
    const identity = screen.getByTestId("checklist-identity");
    expect(
      within(identity).getByText("Needed before the specialist accepts the work"),
    ).toBeVisible();
    expect(within(identity).getByRole("link", { name: "Verify" })).toHaveAttribute(
      "href",
      "/verify-identity",
    );
    expect(
      within(screen.getByTestId("checklist-agreement")).getByRole("link", { name: "Review" }),
    ).toHaveAttribute("href", "#agreement");
    expect(
      within(screen.getByTestId("checklist-payouts")).getByRole("link", { name: "Set up" }),
    ).toBeVisible();
  });

  it("ticks off what is done and keeps the rest", () => {
    renderChecklist({ identity: "verified", agreement: { proposed: true, accepted: true } });
    expect(screen.getByText("2 of 3 done")).toBeVisible();
    expect(screen.getByTestId("checklist-identity")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("checklist-agreement")).toHaveAttribute("data-state", "done");
    expect(screen.getByTestId("checklist-payouts")).toHaveAttribute("data-state", "action");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("shows all done without buttons", () => {
    renderChecklist({
      identity: "verified",
      agreement: { proposed: true, accepted: true },
      payoutsReady: true,
    });
    expect(screen.getByText("3 of 3 done")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("tells an organisation consignor who they are waiting on", () => {
    renderChecklist(
      {
        identity: "verified",
        viewer: { canAcceptAgreement: false, canSetUpPayouts: false },
      },
      { accountKind: "organisation", organisationName: "Northbank Gallery" },
    );
    expect(screen.getByText("Waiting for Northbank Gallery's payout setup")).toBeVisible();
    expect(screen.getByText("An owner or admin of Northbank Gallery accepts this")).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
