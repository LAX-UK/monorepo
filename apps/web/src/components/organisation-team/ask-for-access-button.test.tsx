import { TooltipProvider } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/organisation-team/organisation-team.actions", () => ({
  askForAccessAction: vi.fn(async () => ({ ok: true })),
  withdrawAccessRequestAction: vi.fn(async () => ({ ok: true })),
}));

import { NoAccessActions } from "./ask-for-access-button";

describe("Ask for access", () => {
  it("says what the new role would replace before the request is sent", () => {
    render(
      <TooltipProvider>
        <NoAccessActions
          legalEntityId="org"
          page="Bids"
          roles={["buyer_agent"]}
          waiting={null}
          currentRole="finance"
        />
      </TooltipProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ask for access" }));
    expect(
      screen.getByText(/^This replaces your Finance role, so you'd lose .*Sold & payouts/),
    ).toBeInTheDocument();
  });

  it("shows the request already sent, with a way to withdraw it", () => {
    render(
      <NoAccessActions
        legalEntityId="org"
        page="Bids"
        roles={["buyer_agent"]}
        waiting={{ id: "r1", role: "buyer_agent" }}
        currentRole="finance"
      />,
    );
    expect(screen.getByText("Request sent")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Withdraw request" })).toBeInTheDocument();
  });
});
