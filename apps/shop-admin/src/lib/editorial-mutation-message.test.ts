import { describe, expect, it } from "vitest";
import { editorialMutationErrorMessage } from "./editorial-mutation-message";

describe("editorialMutationErrorMessage", () => {
  it("hides upstream failure text behind friendly copy", () => {
    const message = editorialMutationErrorMessage(
      { ok: false, kind: "failed", message: 'duplicate key value violates "shop_page_slug_key"' },
      "save the page",
    );
    expect(message).toBe("Could not save the page. The service is unavailable. Try again.");
  });

  it("names the slug when shop-api reports a conflict", () => {
    expect(
      editorialMutationErrorMessage(
        { ok: false, kind: "conflict", message: "Slug is already in use" },
        "save the page",
      ),
    ).toBe("Could not save the page: that slug is already in use. Choose a different slug.");
  });

  it("summarises validation rejections", () => {
    expect(
      editorialMutationErrorMessage(
        { ok: false, kind: "validation", message: "body/slug must match pattern" },
        "save",
      ),
    ).toBe("Could not save: the server rejected some fields. Check the form and try again.");
  });

  it("keeps session and permission messages", () => {
    expect(editorialMutationErrorMessage({ ok: false, kind: "unauthorized" }, "save")).toBe(
      "Session expired. Sign in again.",
    );
    expect(editorialMutationErrorMessage({ ok: false, kind: "forbidden" }, "save")).toBe(
      "You do not have permission for this action.",
    );
  });
});
