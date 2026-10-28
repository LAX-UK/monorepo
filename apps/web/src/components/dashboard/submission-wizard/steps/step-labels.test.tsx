import { EMPTY_SUBMISSION_FORM_VALUES } from "@/lib/forms/submission/item-submission-form-defaults";
import { Form } from "@auction/ui/components/form";
import type { ItemSubmissionFormValues } from "@auction/validators";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { BasicsStep } from "./basics-step";
import { DetailsStep } from "./details-step";
import { PricingStep } from "./pricing-step";
import { ProvenanceStep } from "./provenance-step";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

type Step = typeof DetailsStep;

function Harness({ step: StepComponent }: { step: Step }) {
  const form = useForm<ItemSubmissionFormValues>({
    defaultValues: {
      ...EMPTY_SUBMISSION_FORM_VALUES,
      provenance: [{ period: "", note: "" }],
      exhibitions: [{ year: "", venue: "", note: "" }],
    },
  });
  return (
    <Form {...form}>
      <StepComponent form={form} isSubmitting={false} />
    </Form>
  );
}

describe("submission form labels", () => {
  it.each([
    ["basics", (props: Parameters<Step>[0]) => <BasicsStep {...props} categories={[]} />],
    ["details", DetailsStep],
    ["pricing", PricingStep],
    ["provenance", ProvenanceStep],
  ] as const)("the %s step labels are sentence case at 12px or more", (_name, step) => {
    const { container } = render(<Harness step={step} />);
    const labels = container.querySelectorAll("label");
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      expect(label.className).not.toMatch(/uppercase|tracking-/);
      expect(label.className).not.toMatch(/text-\[(9|10|11)px\]|text-label-1/);
      expect(label.querySelector("[class*='uppercase']")).toBeNull();
    }
    for (const caption of container.querySelectorAll("[class*='uppercase']")) {
      throw new Error(`all-caps text: ${caption.textContent}`);
    }
  });
});
