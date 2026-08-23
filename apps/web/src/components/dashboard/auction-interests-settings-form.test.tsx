import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/settings/interests/actions", () => ({
  saveAuctionInterestPreferences: vi.fn(),
  INITIAL_AUCTION_INTERESTS_SETTINGS_ACTION_STATE: { error: null },
}));
vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
  }) => (
    // biome-ignore lint/a11y/useAltText: alt is supplied by the component under test.
    <img {...props} />
  ),
}));

describe("AuctionInterestsSettingsForm", () => {
  const completeCategoryIdBySlug = Object.fromEntries(
    BUYER_INTERESTS.map((interest, index) => [
      interest.categorySlug,
      `category-${index.toString()}`,
    ]),
  );

  it("updates selections without onboarding skip copy", () => {
    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: /skip personalization/i })).not.toBeInTheDocument();
    expect(screen.getByText(/changes here do not repeat onboarding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Art" }));
    expect(screen.getByRole("button", { name: "Save interests" })).toBeVisible();
  });

  it("surfaces an incomplete catalogue and prevents a destructive partial save", () => {
    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={{ paintings: "category-art" }}
        initialCategoryIds={[]}
      />,
    );

    expect(
      screen.getByText("Some categories are temporarily unavailable").closest('[role="alert"]'),
    ).toHaveTextContent("1 of 8 interest categories are available right now.");
    expect(screen.getAllByText("Unavailable")).toHaveLength(7);
    expect(screen.getAllByText("Watches")).not.toHaveLength(0);
    expect(screen.queryByRole("checkbox", { name: "Watches" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save interests" })).toBeDisabled();
  });
});
