import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/settings/interests/actions", () => ({
  saveAuctionInterestPreferences: vi.fn(),
}));
const { actionState, replace } = vi.hoisted(() => ({
  actionState: {
    current: { error: null, redirectTo: null, diagnostic: null } as {
      error: string | null;
      redirectTo: string | null;
      diagnostic: null;
    },
  },
  replace: vi.fn(),
}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
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

  beforeEach(() => {
    actionState.current = { error: null, redirectTo: null, diagnostic: null };
    replace.mockReset();
  });

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

  it("navigates after the server confirms a successful save", async () => {
    actionState.current = {
      error: null,
      redirectTo: "/dashboard/settings/interests?saved=1",
      diagnostic: null,
    };

    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={[]}
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard/settings/interests?saved=1");
    });
  });
});
