import { textOf } from "@/test/text-of";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PersonalNameForm } from "./personal-name-form.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  renameAccountAction: vi.fn(),
}));

const render = (initialName: string | null) =>
  renderToStaticMarkup(
    <PersonalNameForm initialName={initialName} maxLength={200} returnTo="/account/profile" />,
  );

describe("PersonalNameForm", () => {
  it("shows the current name in a labelled field with the length limit", () => {
    const html = render("Ada Lovelace");
    expect(html).toContain("<label");
    expect(html).toContain('value="Ada Lovelace"');
    expect(html).toContain('maxLength="200"');
    expect(html).toContain('autoComplete="name"');
  });

  it("starts empty for a person with no name and keeps Save name off until something changes", () => {
    const html = render(null);
    expect(html).toContain('value=""');
    expect(html).toMatch(/<button[^>]*disabled[^>]*>(?:<span[^>]*>)*Save name/);
  });

  it("says where the name is used", () => {
    expect(textOf(render("Ada"))).toContain(
      "Your name is shared with LAX Bid, LAX Shop and lax.art.",
    );
  });
});
