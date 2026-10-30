import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Button,
  LaxDensityProvider,
  MetricCell,
  Notice,
  Switch,
  laxDensityAttributes,
  useLayerAttributes,
} from "./index.js";

function LayerProbe() {
  return <span data-testid="layer" {...useLayerAttributes()} />;
}

describe("density", () => {
  it("is set on the shell root as one attribute", () => {
    expect(laxDensityAttributes("client")).toEqual({ "data-lax-density": "client" });
  });

  it("reaches a portalled layer through the provider, which sits outside the shell's attribute", () => {
    const { rerender } = render(<LayerProbe />);
    expect(screen.getByTestId("layer")).toHaveAttribute("data-lax-ui", "");
    expect(screen.getByTestId("layer")).not.toHaveAttribute("data-lax-density");
    rerender(
      <LaxDensityProvider density="client">
        <LayerProbe />
      </LaxDensityProvider>,
    );
    expect(screen.getByTestId("layer")).toHaveAttribute("data-lax-density", "client");
  });

  it("draws the button label at the interface step of the density, and grows client controls", () => {
    render(<Button>Save</Button>);
    const { className } = screen.getByRole("button", { name: "Save" });
    expect(className).toContain("text-lax-ui");
    expect(className).toContain("lax-target");
    expect(className).toContain("in-data-[lax-density=client]:px-4");
  });

  it("sizes the switch 32×20 for staff and 40×24 for clients", () => {
    render(<Switch aria-label="Lot closing soon" />);
    const { className } = screen.getByRole("switch", { name: "Lot closing soon" });
    expect(className).toContain("h-5 w-8");
    expect(className).toContain("in-data-[lax-density=client]:h-6");
    expect(className).toContain("in-data-[lax-density=client]:w-10");
  });

  it("keeps a client information notice calm and names its tone", () => {
    render(<Notice title="Bidding opens on 12 Nov." />);
    const notice = screen.getByRole("status");
    expect(notice).toHaveAttribute("data-tone", "info");
    expect(notice.className).toContain("in-data-[lax-density=client]:bg-lax-surface");
    expect(notice.className).toContain("rounded-lax-card");
  });
});

describe("MetricCell without data", () => {
  it("says what the missing figure means instead of a dash, when told", () => {
    render(
      <MetricCell
        item={{
          id: "sold",
          label: "Sold this year",
          value: null,
          emptyText: "Nothing sold yet this year",
        }}
      />,
    );
    expect(screen.getByText("Nothing sold yet this year")).toBeInTheDocument();
    expect(screen.queryByText("No data")).not.toBeInTheDocument();
  });

  it("falls back to a spoken dash", () => {
    render(<MetricCell item={{ id: "sold", label: "Sold this year", value: null }} />);
    expect(screen.getByText("No data")).toHaveClass("sr-only");
  });
});
