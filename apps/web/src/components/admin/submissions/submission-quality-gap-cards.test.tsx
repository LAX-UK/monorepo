import { SubmissionQualityGapCards } from "@/components/admin/submissions/submission-quality-gap-cards";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SubmissionQualityGapCards", () => {
  it("renders amber gap cards with title and description", () => {
    render(
      <SubmissionQualityGapCards
        gaps={[
          {
            id: "signature",
            label: "Signature",
            description:
              "Signature not clearly visible in any provided image. Request a detail capture.",
            severity: "warning",
          },
        ]}
      />,
    );

    expect(screen.getByText(/Quality gaps \(1\)/i)).toBeTruthy();
    expect(screen.getByText("Signature")).toBeTruthy();
    expect(
      screen.getByText(
        "Signature not clearly visible in any provided image. Request a detail capture.",
      ),
    ).toBeTruthy();
  });

  it("renders nothing when there are no gaps", () => {
    const { container } = render(<SubmissionQualityGapCards gaps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
