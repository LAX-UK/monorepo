/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopQuantityStepper } from "./shop-quantity-stepper";

afterEach(cleanup);

describe("ShopQuantityStepper", () => {
  it("names the group and both buttons after the item, and states the rule", () => {
    render(
      <ShopQuantityStepper
        value={1}
        max={2}
        itemLabel="Warm Basket"
        hint="Limit 2 per order"
        onChange={() => {}}
      />,
    );
    const group = screen.getByRole("group", { name: "Quantity" });
    const hintId = group.getAttribute("aria-describedby");
    expect(hintId && document.getElementById(hintId)?.textContent).toBe("Limit 2 per order");
    expect(
      (
        screen.getByRole("button", {
          name: "Decrease quantity of Warm Basket",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Increase quantity of Warm Basket",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("steps by one and stops at the ceiling", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ShopQuantityStepper value={1} max={2} itemLabel="Warm Basket" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Increase quantity of Warm Basket" }));
    expect(onChange).toHaveBeenCalledWith(2);

    rerender(<ShopQuantityStepper value={2} max={2} itemLabel="Warm Basket" onChange={onChange} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Increase quantity of Warm Basket",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Decrease quantity of Warm Basket" }));
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("disables both buttons while an update is in flight", () => {
    render(
      <ShopQuantityStepper
        value={1}
        max={2}
        itemLabel="Warm Basket"
        disabled
        onChange={() => {}}
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
