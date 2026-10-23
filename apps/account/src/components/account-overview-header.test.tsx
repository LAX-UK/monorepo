import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountOverviewHeader } from "./account-overview-header";

describe("AccountOverviewHeader", () => {
  it("shows the name, initials, email and the one-account line", () => {
    const html = renderToStaticMarkup(
      <AccountOverviewHeader
        overview={{ displayName: "Ada Lovelace", name: "Ada Lovelace", email: "ada@example.com" }}
      />,
    );
    expect(html).toContain("<h1");
    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("ada@example.com");
    expect(html).toContain(">AL<");
    expect(html).toContain("One LAX Account for Bid, Shop and lax.art.");
  });

  it("does not repeat the email when it is already the display name", () => {
    const html = renderToStaticMarkup(
      <AccountOverviewHeader
        overview={{ displayName: "ada@example.com", name: null, email: "ada@example.com" }}
      />,
    );
    expect(html.match(/ada@example\.com/g)).toHaveLength(1);
    expect(html).toContain(">A<");
  });

  it("omits the avatar when there is neither a name nor an email", () => {
    const html = renderToStaticMarkup(
      <AccountOverviewHeader
        overview={{ displayName: "Your LAX Account", name: null, email: null }}
      />,
    );
    expect(html).toContain("Your LAX Account");
    expect(html).not.toContain("size-16");
  });
});
