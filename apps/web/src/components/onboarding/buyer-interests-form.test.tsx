import { BuyerInterestsForm } from "@/components/onboarding/buyer-interests-form";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(task)/onboarding/interests/actions", () => ({
  completeBuyerInterests: vi.fn(),
  INITIAL_BUYER_INTERESTS_ACTION_STATE: {
    error: null,
    redirectTo: null,
    submission: null,
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

describe("BuyerInterestsForm", () => {
  it("exposes labelled checkbox choices and updates selection accessibly", () => {
    render(
      <BuyerInterestsForm
        next="/dashboard/watchlist"
        source="post_verify"
        categoryIdBySlug={{ paintings: "category-art", "watches-clocks": "category-watches" }}
        initialCategoryIds={["category-art"]}
      />,
    );
    expect(screen.getByRole("group", { name: /choose your areas of interest/i })).toBeVisible();
    const art = screen.getByRole("checkbox", { name: "Art" });
    const watches = screen.getByRole("checkbox", { name: "Watches" });
    expect(art).toBeChecked();
    expect(watches).not.toBeChecked();
    fireEvent.click(watches);
    fireEvent.click(art);
    expect(watches).toBeChecked();
    expect(art).not.toBeChecked();
    const skipButton = screen.getByRole("button", { name: /skip personalization/i });
    expect(skipButton).toHaveAttribute("name", "skip");
    expect(skipButton).toHaveClass("bg-transparent", "text-secondary", "shadow-none");
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute("type", "submit");
  });

  it("submits selected category ids via hidden inputs", () => {
    const { container } = render(
      <BuyerInterestsForm
        next="/dashboard/watchlist"
        source="post_verify"
        categoryIdBySlug={{ paintings: "category-art", "watches-clocks": "category-watches" }}
        initialCategoryIds={["category-art"]}
      />,
    );

    expect(container.querySelectorAll('input[type="hidden"][name="categoryId"]')).toHaveLength(1);
    expect(container.querySelector('input[type="hidden"][name="categoryId"]')).toHaveValue(
      "category-art",
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Watches" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Art" }));

    const hiddenInputs = container.querySelectorAll('input[type="hidden"][name="categoryId"]');
    expect(hiddenInputs).toHaveLength(1);
    expect(hiddenInputs[0]).toHaveValue("category-watches");
  });

  it("omits manifest choices that have no live category mapping", () => {
    render(
      <BuyerInterestsForm
        next="/dashboard"
        source="post_verify"
        categoryIdBySlug={{ paintings: "category-art" }}
        initialCategoryIds={[]}
      />,
    );
    expect(screen.getByRole("checkbox", { name: "Art" })).toBeVisible();
    expect(screen.queryByRole("checkbox", { name: "Watches" })).not.toBeInTheDocument();
  });
});
