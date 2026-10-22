import { describe, expect, it } from "vitest";
import {
  buildHelpArticlePayload,
  buildHelpCategoryPayload,
  emptyHelpArticleForm,
  slugFromTitle,
} from "./help-forms";

const CATEGORY = "11111111-1111-4111-8111-111111111111";

describe("buildHelpArticlePayload", () => {
  const valid = {
    ...emptyHelpArticleForm(CATEGORY),
    slug: "how-do-i-pay",
    question: "  How do I pay?  ",
  };

  it("trims the question and turns blank SEO fields into clears", () => {
    expect(buildHelpArticlePayload(valid, [])).toEqual({
      ok: true,
      payload: {
        categoryId: CATEGORY,
        slug: "how-do-i-pay",
        question: "How do I pay?",
        body: [],
        seoTitle: null,
        seoDescription: null,
      },
    });
  });

  it("reports a missing question, a bad slug and a missing category", () => {
    const result = buildHelpArticlePayload(
      { ...valid, question: " ", slug: "Not A Slug", categoryId: "" },
      [],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["categoryId", "question", "slug"]);
    }
  });

  it("rejects a question over the 300-character limit before the server does", () => {
    const result = buildHelpArticlePayload({ ...valid, question: "q".repeat(301) }, []);
    expect(result).toMatchObject({
      ok: false,
      errors: { question: "Question must be 300 characters or fewer." },
    });
  });
});

describe("buildHelpCategoryPayload", () => {
  it("accepts a title and slug", () => {
    expect(buildHelpCategoryPayload({ title: " Buying ", slug: "buying" })).toEqual({
      ok: true,
      payload: { title: "Buying", slug: "buying" },
    });
  });

  it("rejects a blank title and a malformed slug", () => {
    const result = buildHelpCategoryPayload({ title: "", slug: "Buying!" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["slug", "title"]);
  });
});

describe("slugFromTitle", () => {
  it("lowercases, hyphenates and drops accents and punctuation", () => {
    expect(slugFromTitle("Shipping & Delivery")).toBe("shipping-delivery");
    expect(slugFromTitle("  Your account!  ")).toBe("your-account");
    expect(slugFromTitle("Café culture")).toBe("cafe-culture");
  });

  it("is empty for a title with no usable characters", () => {
    expect(slugFromTitle("!!!")).toBe("");
  });
});
