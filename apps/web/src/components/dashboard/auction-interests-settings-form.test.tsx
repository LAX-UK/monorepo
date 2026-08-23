import { AuctionInterestsSettingsForm } from "@/components/dashboard/auction-interests-settings-form";
import { BUYER_INTERESTS } from "@/lib/onboarding/buyer-interest-manifest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/dashboard/settings/interests/actions", () => ({
  saveAuctionInterestPreferences: vi.fn(),
}));
const { actionState, notifyError, notifySuccess, refresh, replace } = vi.hoisted(() => ({
  actionState: {
    current: { error: null, redirectTo: null, savedCategoryIds: null } as {
      error: string | null;
      redirectTo: string | null;
      savedCategoryIds: string[] | null;
    },
  },
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  refresh: vi.fn(),
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
  useRouter: () => ({ refresh, replace }),
}));
vi.mock("@/lib/ui/notify", () => ({
  notify: {
    error: notifyError,
    success: notifySuccess,
  },
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
    actionState.current = { error: null, redirectTo: null, savedCategoryIds: null };
    notifyError.mockReset();
    notifySuccess.mockReset();
    refresh.mockReset();
    replace.mockReset();
  });

  it("shows selection status and enables saving only for unsaved changes", () => {
    render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: /skip personalization/i })).not.toBeInTheDocument();
    expect(screen.getByText(/changes here do not repeat onboarding/i)).toBeInTheDocument();
    expect(screen.getByText("0 of 8 categories selected")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save interests" })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "Art" }));

    expect(screen.getByText("1 of 8 categories selected · Unsaved changes")).toBeVisible();
    expect(screen.getByRole("button", { name: "Save interests" })).toBeEnabled();
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

  it("reconciles selections when refreshed server props change", async () => {
    const artId = completeCategoryIdBySlug.paintings;
    const watchesId = completeCategoryIdBySlug["watches-clocks"];
    const { rerender } = render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={[artId]}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Art" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("checkbox", { name: "Watches" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    rerender(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={[watchesId]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Art" })).toHaveAttribute(
        "aria-checked",
        "false",
      );
      expect(screen.getByRole("checkbox", { name: "Watches" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Save interests" })).toBeDisabled();
  });

  it("refreshes and reconciles every confirmed save", async () => {
    const initialCategoryIds: string[] = [];
    const artId = completeCategoryIdBySlug.paintings;
    const watchesId = completeCategoryIdBySlug["watches-clocks"];
    const { rerender } = render(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={initialCategoryIds}
      />,
    );

    actionState.current = {
      error: null,
      redirectTo: "/dashboard/settings/interests?saved=1",
      savedCategoryIds: [artId],
    };
    rerender(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={initialCategoryIds}
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/dashboard/settings/interests?saved=1");
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(notifySuccess).toHaveBeenCalledWith("Auction interests saved", {
        id: "auction-interests-settings-save-succeeded",
      });
      expect(screen.getByRole("checkbox", { name: "Art" })).toHaveAttribute("aria-checked", "true");
    });

    actionState.current = {
      error: null,
      redirectTo: "/dashboard/settings/interests?saved=1",
      savedCategoryIds: [artId, watchesId],
    };
    rerender(
      <AuctionInterestsSettingsForm
        categoryIdBySlug={completeCategoryIdBySlug}
        initialCategoryIds={initialCategoryIds}
      />,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledTimes(2);
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(notifySuccess).toHaveBeenCalledTimes(2);
      expect(screen.getByRole("checkbox", { name: "Watches" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });
    expect(screen.getByRole("button", { name: "Save interests" })).toBeDisabled();
  });
});
