import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  AccountPageHeader,
  AccountSection,
  BackLink,
  ListCard,
  ListCardRow,
  SettingsGroup,
} from "./account-ui";

describe("AccountPageHeader", () => {
  it("is the page's one h1, with the description under it and no back link by default", () => {
    const html = renderToStaticMarkup(
      <AccountPageHeader title="Security" description="Your password and devices." />,
    );
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Security");
    expect(html).toContain("Your password and devices.");
    expect(html).not.toContain("href=");
  });

  it("names where back goes on a page below another", () => {
    const html = renderToStaticMarkup(
      <AccountPageHeader
        title="Delete your account"
        backHref="/account/security"
        backLabel="Security"
      />,
    );
    expect(html).toContain('href="/account/security"');
    expect(html).toContain("Security");
  });
});

describe("BackLink", () => {
  it("is a plain link at least 44px tall", () => {
    const html = renderToStaticMarkup(<BackLink href="/account/portfolio" label="Portfolio" />);
    expect(html).toContain('href="/account/portfolio"');
    expect(html).toContain("min-h-11");
  });
});

describe("AccountSection", () => {
  it("labels the section by its h2 and keeps the id as an anchor", () => {
    const html = renderToStaticMarkup(
      <AccountSection id="backup-codes" title="Backup codes" description="Each code works once.">
        <p>Body</p>
      </AccountSection>,
    );
    expect(html).toContain('id="backup-codes"');
    expect(html).toContain('aria-labelledby="backup-codes-heading"');
    expect(html).toContain('<h2 id="backup-codes-heading"');
    expect(html).toContain("Each code works once.");
  });
});

describe("ListCard", () => {
  it("makes a row a whole-row link with a chevron when it has an href", () => {
    const html = renderToStaticMarkup(
      <ListCard>
        <ListCardRow title="Password" subtitle="Change it" href="/change" />
        <ListCardRow
          title="Email address"
          value="a***@example.com"
          trailing={<span>Verified</span>}
        />
      </ListCard>,
    );
    expect(html).toContain('<a href="/change"');
    expect(html).toContain("Change it");
    expect(html).toContain("a***@example.com");
    expect(html).toContain("Verified");
    // The second row is not a link.
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("wraps a long value instead of overflowing", () => {
    const html = renderToStaticMarkup(
      <ListCard>
        <ListCardRow title="Email" value="a-very-long-address@example.com" />
      </ListCard>,
    );
    expect(html).toContain("[overflow-wrap:anywhere]");
  });
});

describe("SettingsGroup", () => {
  it("renders the label as an h2 in sentence case and each row as a link", () => {
    const html = renderToStaticMarkup(
      <SettingsGroup
        group={{
          id: "sign-in",
          label: "Signing in",
          rows: [{ title: "Password", href: "/p" }],
        }}
      />,
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Signing in");
    expect(html).not.toContain("uppercase");
    expect(html).toContain('href="/p"');
  });
});
