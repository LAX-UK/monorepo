import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { buyerPremiumBandProblem } from "@/lib/forms/schemas/admin-sale-form";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useFieldArray, useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saleBuyerPremiumPreview, useSaleTierBandPreview } from "../../use-sale-tier-preview";
import { BuyerPremiumSection } from "./buyer-premium-section";

afterEach(cleanup);

/** The section as the wizard wires it: a real band list and the live worked example. */
function LiveHarness({
  values,
  isDraft = true,
}: {
  values: Partial<AdminSaleFormValues>;
  isDraft?: boolean;
}) {
  const form = useForm<AdminSaleFormValues>({
    defaultValues: { ...emptyAdminSaleFormValues(), ...values },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "buyerPremiumTiers",
  });
  const preview = useSaleTierBandPreview(form);
  return (
    <BuyerPremiumSection
      form={form}
      isDraft={isDraft}
      fields={fields}
      append={append}
      remove={remove}
      tierBandPreview={preview}
    />
  );
}

const STANDARD_ROWS = [
  { hammerThresholdMajor: "0", rate: "0.15" },
  { hammerThresholdMajor: "500000", rate: "0.1" },
];

function Harness({
  values,
  syncsToAtg,
}: {
  values: Partial<AdminSaleFormValues>;
  syncsToAtg?: boolean;
}) {
  const defaults = { ...emptyAdminSaleFormValues(), ...values };
  const form = useForm<AdminSaleFormValues>({ defaultValues: defaults });
  return (
    <BuyerPremiumSection
      form={form}
      isDraft
      fields={[]}
      append={vi.fn()}
      remove={vi.fn()}
      tierBandPreview={saleBuyerPremiumPreview(defaults)}
      syncsToAtg={syncsToAtg}
    />
  );
}

describe("BuyerPremiumSection", () => {
  it("preselects the standard premium for a new sale and shows a worked example", () => {
    render(<Harness values={{}} />);
    expect(screen.getByRole("radio", { name: /^Standard/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Flat rate/ })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Custom bands/ })).not.toBeChecked();
    // The terms appear once, in the example's title, not in the choice as well.
    expect(screen.getAllByText(/15% up to £500,000, then 10% on the part above/)).toHaveLength(1);
    const example = screen.getByRole("status", { name: /^Buyer's premium/ });
    expect(example).toHaveTextContent(
      "Buyer's premium: 15% up to £500,000, then 10% on the part above",
    );
    expect(example).toHaveTextContent("On a £600,000 hammer the buyer's premium is £85,000.");
  });

  it("keeps a polite status line, and prompts to fix invalid bands instead of vanishing", () => {
    render(<Harness values={{ buyerPremiumMode: "bands" }} />);
    const status = screen.getByRole("status", { name: /^Buyer's premium/ });
    expect(status).toHaveTextContent("Fix the bands to see an example.");
  });

  it("tells staff an ATG-synced sale takes one flat rate, and stays silent otherwise", () => {
    const { unmount } = render(<Harness values={{}} />);
    expect(screen.queryByText(/ATG takes one flat rate/)).not.toBeInTheDocument();
    unmount();
    render(<Harness values={{}} syncsToAtg />);
    expect(screen.getByText(/ATG takes one flat rate/)).toBeInTheDocument();
  });

  it("asks for the rate when the sale charges a flat rate", () => {
    render(<Harness values={{ buyerPremiumMode: "flat", buyerPremiumRate: "0.2" }} />);
    expect(screen.getByRole("radio", { name: /Flat rate/ })).toBeChecked();
    expect(screen.getByLabelText("Flat rate")).toBeInTheDocument();
    // The choice says the rate is on the whole hammer; the field does not say it again.
    expect(screen.getAllByText(/on the whole hammer price/)).toHaveLength(1);
    expect(
      screen.getByText("On a £600,000 hammer the buyer's premium is £120,000."),
    ).toBeInTheDocument();
  });

  it("shows band 1's fixed start in a labelled field, like the field beside it", () => {
    render(
      <LiveHarness values={{ buyerPremiumMode: "bands", buyerPremiumTiers: STANDARD_ROWS }} />,
    );
    expect(screen.getAllByText("From hammer")).toHaveLength(2);
    expect(screen.getByLabelText("From hammer", { selector: "output" })).toHaveTextContent("£0.00");
  });

  it("says what a half-filled band needs, and holds the example until every band is complete", () => {
    render(
      <LiveHarness values={{ buyerPremiumMode: "bands", buyerPremiumTiers: STANDARD_ROWS }} />,
    );
    expect(screen.getByRole("status", { name: /^Buyer's premium/ })).toHaveTextContent("£85,000.");
    fireEvent.click(screen.getByRole("button", { name: "Add band" }));
    expect(screen.getByRole("status", { name: /^Buyer's premium/ })).toHaveTextContent(
      "Finish every band to see an example.",
    );
    expect(screen.queryByText(/On a £600,000 hammer/)).toBeNull();
    const rates = screen.getAllByRole("textbox", { name: /Rate/ });
    fireEvent.blur(rates[2] as HTMLElement);
    expect(screen.getByText("Band 3 needs a rate and a starting hammer")).toBeInTheDocument();
  });

  it("says so when removing band 1 moves the next band to start at £0", () => {
    render(
      <LiveHarness values={{ buyerPremiumMode: "bands", buyerPremiumTiers: STANDARD_ROWS }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove band 1" }));
    const note = screen.getByText("Band 1 now starts at £0").closest("[role=status]");
    expect(note).not.toBeNull();
    expect(within(note as HTMLElement).getByText(/It started at £500,000\.00/)).toBeInTheDocument();
    expect(screen.getByRole("status", { name: /^Buyer's premium/ })).toHaveTextContent(
      "On a £600,000 hammer the buyer's premium is £60,000.",
    );
  });

  it("shows every choice, chosen or not, on a published sale", () => {
    render(<LiveHarness values={{}} isDraft={false} />);
    for (const name of [/^Standard/, /Flat rate/, /Custom bands/]) {
      expect(screen.getByRole("radio", { name })).toBeDisabled();
    }
  });
});

describe("buyerPremiumBandProblem", () => {
  it("names what each band still needs", () => {
    expect(buyerPremiumBandProblem({ hammerThresholdMajor: "", rate: "" }, 1)).toBe(
      "Band 2 needs a rate and a starting hammer",
    );
    expect(buyerPremiumBandProblem({ hammerThresholdMajor: "", rate: "0.1" }, 1)).toBe(
      "Band 2 needs a starting hammer",
    );
    expect(buyerPremiumBandProblem({ hammerThresholdMajor: "100", rate: "" }, 2)).toBe(
      "Band 3 needs a rate",
    );
    expect(buyerPremiumBandProblem({ hammerThresholdMajor: "", rate: "" }, 0)).toBe(
      "Band 1 needs a rate",
    );
    expect(buyerPremiumBandProblem({ hammerThresholdMajor: "", rate: "0.2" }, 0)).toBeNull();
  });
});

describe("saleBuyerPremiumPreview", () => {
  it("words the custom bands and works them slice by slice", () => {
    expect(
      saleBuyerPremiumPreview({
        buyerPremiumMode: "bands",
        buyerPremiumRate: "",
        buyerPremiumTiers: [
          { hammerThresholdMajor: "0", rate: "0.2" },
          { hammerThresholdMajor: "100000", rate: "0.1" },
        ],
      }),
    ).toEqual({
      ok: true,
      terms: "20% up to £100,000, then 10% on the part above",
      example: "On a £600,000 hammer the buyer's premium is £70,000.",
    });
  });

  it("has no example while a band is half-filled", () => {
    expect(
      saleBuyerPremiumPreview({
        buyerPremiumMode: "bands",
        buyerPremiumRate: "",
        buyerPremiumTiers: [
          { hammerThresholdMajor: "0", rate: "0.2" },
          { hammerThresholdMajor: "100000", rate: "" },
        ],
      }),
    ).toEqual({ ok: false, reason: "incomplete" });
  });

  it("has nothing to show for a flat rate not yet entered", () => {
    expect(
      saleBuyerPremiumPreview({
        buyerPremiumMode: "flat",
        buyerPremiumRate: "",
        buyerPremiumTiers: [],
      }),
    ).toEqual({ ok: false });
  });
});
