import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RadioCardGroup } from "./radio-card-group.js";

const OPTIONS = [
  { value: "individual", label: "An individual", description: "Bid and buy." },
  { value: "organisation", label: "Organisation", description: "Sell and consign." },
] as const;

describe("RadioCardGroup", () => {
  it("renders options and forwards selection", () => {
    const onValueChange = vi.fn();
    render(
      <RadioCardGroup
        legend="I'm joining as…"
        value="individual"
        onValueChange={onValueChange}
        options={OPTIONS}
      />,
    );

    expect(screen.getByRole("group", { name: /i'm joining as/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /an individual/i })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /organisation/i }));
    expect(onValueChange).toHaveBeenCalledWith("organisation");
  });

  it("shows a meta value beside the label and uses a given radio id", () => {
    render(
      <RadioCardGroup
        legend="Delivery"
        value="post"
        onValueChange={vi.fn()}
        options={[
          {
            value: "post",
            label: "Post",
            meta: "£15.00",
            description: "To your door",
            id: "opt-post",
          },
          { value: "collect", label: "Collect", meta: "Free" },
        ]}
      />,
    );
    const radio = screen.getByRole("radio", { name: /post/i });
    expect(radio).toHaveAttribute("id", "opt-post");
    expect(screen.getByText("£15.00")).toHaveClass("radio-card__meta");
    expect(screen.getByText("To your door")).toHaveClass("radio-card__description");
  });

  it("shows validation error", () => {
    render(
      <RadioCardGroup
        legend="Choose one"
        value=""
        onValueChange={vi.fn()}
        options={OPTIONS}
        error="Required"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("RadioCardGroup card states", () => {
  function cardFor(name: RegExp) {
    const radio = screen.getByRole("radio", { name });
    const card = radio.closest("label");
    if (!card) throw new Error("radio is not inside its card");
    return { radio, card };
  }

  it("styles the chosen card from the radio's own checked state", () => {
    render(
      <RadioCardGroup
        legend="Who is selling?"
        value="organisation"
        onValueChange={vi.fn()}
        options={OPTIONS}
      />,
    );
    const { radio, card } = cardFor(/organisation/i);
    // Radix renders a button with data-state, not a native input, so :checked never matches.
    expect(radio).toHaveAttribute("data-state", "checked");
    expect(card.className).toContain("has-[[data-state=checked]]:border-primary");
    expect(card.className).toContain("has-[[data-state=checked]]:bg-surface-container-low");
    expect(card.className).toContain("has-[[data-state=checked]]:inset-ring-primary");
    expect(card.className).not.toContain("has-[:checked]");
  });

  it("has hover, focus-visible and disabled states on the card", () => {
    render(
      <RadioCardGroup
        legend="Who is selling?"
        value="individual"
        onValueChange={vi.fn()}
        options={[...OPTIONS, { value: "trust", label: "Trust", disabled: true }]}
      />,
    );
    const { card } = cardFor(/an individual/i);
    expect(card.className).toContain("hover:bg-surface-container-low");
    expect(card.className).toContain("has-[:focus-visible]:ring-primary");
    const disabled = cardFor(/trust/i);
    expect(disabled.radio).toBeDisabled();
    expect(disabled.card.className).toContain("has-[:disabled]:cursor-not-allowed");
  });

  it("keeps a product's own card class last so it can restyle the card", () => {
    render(
      <RadioCardGroup
        legend="Delivery"
        value="individual"
        onValueChange={vi.fn()}
        options={OPTIONS}
        optionClassName="shop-radio-card"
      />,
    );
    const { card } = cardFor(/an individual/i);
    expect(card.className.endsWith("shop-radio-card")).toBe(true);
  });
});
