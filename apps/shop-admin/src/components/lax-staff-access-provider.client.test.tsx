// @vitest-environment jsdom
import { capabilitiesForRoles } from "@auction/shop-domain";
import { Permitted, StaffButton } from "@auction/staff-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { laxStaffAccess } from "../server/domain/lax-staff-access";
import { LaxStaffAccessProvider } from "./lax-staff-access-provider.client";

const capsOf = (...roles: Parameters<typeof capabilitiesForRoles>[0]) => [
  ...capabilitiesForRoles(roles),
];

function Actions() {
  return (
    <>
      <StaffButton requires="editorial.publish">Publish story</StaffButton>
      <StaffButton requires="catalogue.write">Add artwork</StaffButton>
      <Permitted requires={{ anyOf: ["refund.write", "fulfilment.write"] }}>
        <span>Order actions</span>
      </Permitted>
    </>
  );
}

describe("LAX Admin kit actions", () => {
  it("leaves out every action for a Read-only person", () => {
    render(
      <LaxStaffAccessProvider capabilities={capsOf("read_only")} roleLabel="Read-only">
        <Actions />
      </LaxStaffAccessProvider>,
    );
    expect(screen.queryByRole("button", { name: "Publish story" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add artwork" })).toBeNull();
    expect(screen.queryByText("Order actions")).toBeNull();
  });

  it("offers an Editor editorial actions but not catalogue ones", () => {
    render(
      <LaxStaffAccessProvider capabilities={capsOf("editor")} roleLabel="Editor">
        <Actions />
      </LaxStaffAccessProvider>,
    );
    expect(screen.getByRole("button", { name: "Publish story" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add artwork" })).toBeNull();
  });

  it("refuses a permission LAX Admin does not know, and accepts any one of several", () => {
    const access = laxStaffAccess(capsOf("operations"), "Operations");
    expect(access.can("platform.admin.full")).toBe(false);
    expect(access.can({ anyOf: ["refund.write", "fulfilment.write"] })).toBe(true);
    expect(access.roleLabel).toBe("Operations");
  });
});
