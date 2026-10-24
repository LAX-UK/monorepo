import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserOverviewSections } from "./admin-user-overview-sections";

describe("AdminUserOverviewSections", () => {
  it("renders each panel as a labelled, addressable section in order", () => {
    render(
      <AdminUserOverviewSections
        sections={[
          { id: "profile", label: "Profile", content: <p>Profile content</p> },
          { id: "kyc-history", label: "KYC", content: <p>KYC content</p> },
        ]}
      />,
    );

    const profile = screen.getByRole("region", { name: "Profile" });
    const kyc = screen.getByRole("region", { name: "KYC" });
    expect(profile).toHaveAttribute("id", "profile");
    expect(kyc).toHaveAttribute("id", "kyc-history");
    expect(profile.compareDocumentPosition(kyc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
