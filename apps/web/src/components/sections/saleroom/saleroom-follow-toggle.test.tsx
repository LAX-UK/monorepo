import { SaleroomFollowToggle } from "@/components/sections/saleroom/saleroom-follow-toggle";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toggleSaleFollow = vi.fn();
vi.mock("@/lib/data/http/sale-follow.client", () => ({
  toggleSaleFollow: (...args: unknown[]) => toggleSaleFollow(...args),
}));

beforeEach(() => toggleSaleFollow.mockReset());

describe("SaleroomFollowToggle", () => {
  it("sends a visitor to sign in and back to the sale", () => {
    render(
      <SaleroomFollowToggle
        saleId="sale-1"
        initialFollowing={false}
        isAuthenticated={false}
        loginNextPath="/sales/test/sale-1"
        label="Notify me"
      />,
    );
    const link = screen.getByRole("link", { name: "Notify me" });
    expect(link.getAttribute("href")).toContain("next=%2Fsales%2Ftest%2Fsale-1");
  });

  it("follows the sale and then reads Following", async () => {
    toggleSaleFollow.mockResolvedValue(true);
    render(
      <SaleroomFollowToggle
        saleId="sale-1"
        initialFollowing={false}
        isAuthenticated
        loginNextPath="/sales/test/sale-1"
        label="Notify me"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    expect(toggleSaleFollow).toHaveBeenCalledWith("sale-1", false);
    expect(await screen.findByRole("button", { name: "Following" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("stays as it was when following fails", async () => {
    toggleSaleFollow.mockResolvedValue(false);
    render(
      <SaleroomFollowToggle
        saleId="sale-1"
        initialFollowing={false}
        isAuthenticated
        loginNextPath="/sales/test/sale-1"
        label="Notify me"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Notify me" }));
    await waitFor(() => expect(toggleSaleFollow).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Notify me" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
