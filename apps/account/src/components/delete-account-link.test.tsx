import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteAccountLink } from "./delete-account-link";

describe("DeleteAccountLink", () => {
  it("is one quiet link to the Privacy section that holds the deletion", () => {
    const html = renderToStaticMarkup(<DeleteAccountLink />);
    expect(html).toContain('href="/account/privacy#group-your-data"');
    expect(html).toContain("Delete your account");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("/account/security/delete");
  });
});
