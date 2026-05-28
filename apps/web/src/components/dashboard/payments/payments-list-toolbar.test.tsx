import { PaymentsListToolbar } from "@/components/dashboard/payments/payments-list-toolbar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/dashboard/payments",
  useSearchParams: () => new URLSearchParams(),
}));

describe("PaymentsListToolbar", () => {
  it("shows filter badge count and hides desktop sort on mobile layout", () => {
    render(
      <PaymentsListToolbar
        filters={{
          status: "pending",
          q: "",
          sort: "amount-asc",
          year: 2024,
        }}
        years={[2024, 2023]}
      />,
    );

    expect(screen.getAllByRole("button", { name: /Filters, 3 applied/i })).toHaveLength(2);

    const sortComboboxes = screen.getAllByRole("combobox", { name: "Sort" });
    expect(sortComboboxes).toHaveLength(1);
    expect(sortComboboxes[0]?.closest(".lg\\:block")).toBeTruthy();
  });
});
