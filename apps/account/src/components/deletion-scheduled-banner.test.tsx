import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeletionScheduledBanner } from "./deletion-scheduled-banner";

describe("DeletionScheduledBanner", () => {
  it("names the day and links to where the deletion is cancelled", () => {
    const html = renderToStaticMarkup(
      <DeletionScheduledBanner dueOn="2 December" cancelHref="/account/security/delete" />,
    );
    expect(html).toContain("Deletion scheduled for 2 December");
    expect(html).toContain('href="/account/security/delete"');
    expect(html).toContain("Cancel deletion");
    expect(html).toContain('role="note"');
  });
});
