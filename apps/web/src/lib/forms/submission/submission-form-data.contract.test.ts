import { createItemSubmissionSchema } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { EMPTY_SUBMISSION_FORM_VALUES } from "./item-submission-form-defaults";
import { formValuesToCreateItemSubmissionInput } from "./submission-form-data";

const sampleCategoryId = "00000000-0000-4000-8000-000000000001";

describe("submission-form-data contract", () => {
  it("maps form values to input accepted by createItemSubmissionSchema", () => {
    const values = {
      ...EMPTY_SUBMISSION_FORM_VALUES,
      title: "Blue period study",
      description: "Oil on canvas",
      categoryIds: [sampleCategoryId],
      images: ["https://cdn.example.com/art.jpg"],
      askingPrice: "1200.50",
      reservePrice: "1000",
      provenance: [{ period: "2020", note: "Artist studio" }],
      exhibitions: [{ year: "2021", venue: "Gallery X", note: "Solo show" }],
    };

    const apiInput = formValuesToCreateItemSubmissionInput(values);
    const parsed = createItemSubmissionSchema.safeParse(apiInput);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe("Blue period study");
      expect(parsed.data.categoryIds).toEqual([sampleCategoryId]);
    }
  });
});
