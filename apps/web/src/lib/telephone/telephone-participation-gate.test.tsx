import { TelephoneParticipationGate } from "@/lib/telephone/telephone-participation-gate";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("TelephoneParticipationGate", () => {
  it("prompts verification when phone exists but is unverified", () => {
    render(
      <TelephoneParticipationGate
        isAuthenticated
        kycApproved
        mobile="+14155550100"
        phoneNumberVerified={false}
        buyerEntities={[{ id: "1", displayName: "Personal", memberRole: "owner" }]}
        loginNextPath="/sales/test/1"
      >
        <div>child</div>
      </TelephoneParticipationGate>,
    );

    expect(screen.getByText(/verify your contact number/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /verify mobile number/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/settings/profile"),
    );
    expect(screen.queryByText("child")).not.toBeInTheDocument();
  });

  it("renders children when phone is verified", () => {
    render(
      <TelephoneParticipationGate
        isAuthenticated
        kycApproved
        mobile="+14155550100"
        phoneNumberVerified
        buyerEntities={[{ id: "1", displayName: "Personal", memberRole: "owner" }]}
        loginNextPath="/sales/test/1"
      >
        <div>child</div>
      </TelephoneParticipationGate>,
    );

    expect(screen.getByText("child")).toBeInTheDocument();
  });
});
