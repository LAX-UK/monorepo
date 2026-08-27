import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/settings/interests/actions", () => ({
  saveAuctionInterestPreferences: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
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

function requireCategoryId(value: string | undefined): string {
  if (!value) throw new Error("expected a category id");
  return value;
}

describe("AuctionInterestsSettingsForm", () => {
  it("updates selections without onboarding skip copy", () => {
    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={{
          paintings: "category-art",
          "watches-clocks": "category-watches",
          jewellery: "category-jewellery",
          "coins-medals": "category-coins",
          sculpture: "category-sculpture",
          antiques: "category-antiques",
          memorabilia: "category-memorabilia",
          "mixed-media": "category-mixed",
        }}
        initialCategoryIds={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: /skip personalization/i })).not.toBeInTheDocument();
    expect(screen.getByText(/changes here do not repeat onboarding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Art" }));
    expect(screen.getByRole("button", { name: "Save interests" })).toBeEnabled();
  });

  it("does not treat an archived category id as a selected live interest", () => {
    const { container } = render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={{
          paintings: "category-art",
          "watches-clocks": "category-watches",
          jewellery: "category-jewellery",
          "coins-medals": "category-coins",
          sculpture: "category-sculpture",
          antiques: "category-antiques",
          memorabilia: "category-memorabilia",
          "mixed-media": "category-mixed",
        }}
        initialCategoryIds={["archived-category"]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Art" })).not.toBeChecked();
    expect(container.querySelectorAll('input[type="hidden"][name="categoryId"]')).toHaveLength(0);
  });

  it("disables save and surfaces unavailable tiles when the catalog is incomplete", () => {
    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={{ paintings: requireCategoryId("category-art") }}
        initialCategoryIds={[]}
      />,
    );

    expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save interests" })).toBeDisabled();
  });
});
