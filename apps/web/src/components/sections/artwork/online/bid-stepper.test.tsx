import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BidStepper } from "./bid-stepper";

function ControlledStepper(props: { initial: string; min: number; step: number }) {
  const [amount, setAmount] = useState(props.initial);
  return (
    <BidStepper
      amount={amount}
      minNumeric={props.min}
      stepNumeric={props.step}
      onAmountChange={setAmount}
    />
  );
}

describe("BidStepper", () => {
  it("decrements by step toward min", () => {
    render(<ControlledStepper initial="130.00" min={100} step={10} />);
    fireEvent.click(screen.getByRole("button", { name: /decrease bid/i }));
    fireEvent.click(screen.getByRole("button", { name: /decrease bid/i }));
    expect(screen.getByText(/£110\.00/)).toBeInTheDocument();
  });

  it("disables decrease at min", () => {
    const onAmountChange = vi.fn();
    render(
      <BidStepper
        amount="100.00"
        minNumeric={100}
        stepNumeric={10}
        onAmountChange={onAmountChange}
      />,
    );
    expect(screen.getByRole("button", { name: /decrease bid/i })).toBeDisabled();
  });

  it("increments by step", () => {
    const onAmountChange = vi.fn();
    render(
      <BidStepper
        amount="100.00"
        minNumeric={100}
        stepNumeric={10}
        onAmountChange={onAmountChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /increase bid/i }));
    expect(onAmountChange).toHaveBeenCalledWith("110.00");
  });
});
