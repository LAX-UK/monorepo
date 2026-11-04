import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/application/account-identity-actions.server", () => ({
  cancelAccountDeletionAction: vi.fn(),
}));

import { DeletionScheduledBanner } from "./deletion-scheduled-banner.client";

describe("DeletionScheduledBanner", () => {
  it("names the day and offers to keep the account", () => {
    const html = renderToStaticMarkup(
      <DeletionScheduledBanner dueOn="2 December" signInHref="/api/auth/login" />,
    );
    expect(html).toContain("Your account will be deleted on 2 December.");
    expect(html).toContain("Keep my account");
    expect(html).toContain('role="note"');
  });
});
