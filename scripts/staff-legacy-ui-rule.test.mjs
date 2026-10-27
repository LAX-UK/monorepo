import assert from "node:assert/strict";
import { test } from "node:test";
import { legacyUiViolation } from "./staff-legacy-ui-rule.mjs";

test("Bid admin: rejects @auction/ui/components in admin folders only", () => {
  const text = 'import { Button } from "@auction/ui/components/button";';
  assert.ok(legacyUiViolation("web", "components/admin/x.tsx", text));
  assert.ok(legacyUiViolation("web", "app/admin/page.tsx", text));
  assert.equal(legacyUiViolation("web", "components/public/x.tsx", text), null);
  assert.equal(
    legacyUiViolation("web", "components/admin/x.tsx", 'import { cn } from "@auction/ui";'),
    null,
  );
});

test("LAX Admin: rejects the package root and any subpath", () => {
  assert.ok(legacyUiViolation("shop-admin", "app/a.tsx", 'import { Button } from "@auction/ui";'));
  assert.ok(
    legacyUiViolation("shop-admin", "components/a.tsx", "import x from '@auction/ui/lib/utils';"),
  );
  assert.ok(
    legacyUiViolation(
      "shop-admin",
      "components/a.tsx",
      'import { Tooltip } from "@auction/ui/components/tooltip";',
    ),
  );
});

test("LAX Admin: allows the staff kit and tests", () => {
  assert.equal(
    legacyUiViolation(
      "shop-admin",
      "app/a.tsx",
      'import { StaffButton } from "@auction/staff-ui";',
    ),
    null,
  );
  assert.equal(
    legacyUiViolation("shop-admin", "components/a.test.tsx", 'vi.mock("@auction/ui/components/x")'),
    null,
  );
  assert.equal(
    legacyUiViolation("shop-admin", "test/radix-stubs.tsx", 'from "@auction/ui/components/button"'),
    null,
  );
});
