import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserOverviewSections } from "./admin-user-overview-sections";

describe("AdminUserOverviewSections", () => {
  it("renders non-sticky section index with anchor links", () => {
    const { container } = render(
      <AdminUserOverviewSections
        sections={[
          { id: "profile", label: "Profile", content: <p>Profile content</p> },
          { id: "kyc-history", label: "KYC", content: <p>KYC content</p> },
        ]}
      />,
    );

    expect(screen.getByText("On this page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "#profile");
    expect(screen.getByRole("link", { name: "KYC" })).toHaveAttribute("href", "#kyc-history");
    expect(container.querySelector(".sticky")).toBeNull();
  });
});
