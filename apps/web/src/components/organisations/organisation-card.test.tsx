import { OrganisationCard } from "@/components/organisations/organisation-card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("OrganisationCard", () => {
  it("renders summary and manage action when not acting", () => {
    render(
      <OrganisationCard
        summary={{
          id: "org-1",
          displayName: "Test Gallery",
          subkind: "gallery",
          status: "lead",
          role: "owner",
          isPrimaryAdmin: true,
        }}
        isActing={false}
      />,
    );
    expect(screen.getByText("Test Gallery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage/i })).toHaveAttribute(
      "href",
      "/dashboard/organisations/org-1",
    );
    expect(screen.getByRole("link", { name: /continue setup/i })).toBeInTheDocument();
  });

  it("uses API resume href for connect_pending when provided", () => {
    render(
      <OrganisationCard
        summary={{
          id: "org-1",
          displayName: "Test Gallery",
          subkind: "gallery",
          status: "connect_pending",
          role: "owner",
          isPrimaryAdmin: true,
        }}
        isActing={false}
        resumeHref="/onboarding/organisation/step/connect?entityId=org-1"
      />,
    );
    expect(screen.getByRole("link", { name: /finish payout setup/i })).toHaveAttribute(
      "href",
      "/onboarding/organisation/step/connect?entityId=org-1",
    );
  });

  it("shows Active badge when acting", () => {
    render(
      <OrganisationCard
        summary={{
          id: "org-1",
          displayName: "Test Gallery",
          subkind: "gallery",
          status: "approved",
          role: "admin",
          isPrimaryAdmin: false,
        }}
        isActing
      />,
    );
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /manage/i })).not.toBeInTheDocument();
  });
});
