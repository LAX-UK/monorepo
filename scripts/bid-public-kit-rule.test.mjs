import assert from "node:assert/strict";
import { test } from "node:test";
import { isPublicFile, olderElementsImported } from "./bid-public-kit-rule.mjs";

const oldButton = 'import { Button } from "@auction/ui/components/button";';

test("rejects the older Button from its own path and from the package root", () => {
  assert.deepEqual(olderElementsImported("components/marketing/a.tsx", oldButton), ["Button"]);
  assert.deepEqual(
    olderElementsImported("components/sections/a.tsx", 'import { Button, cn } from "@auction/ui";'),
    ["Button"],
  );
});

test("rejects Badge, Alert, Tabs and Input", () => {
  const text = [
    'import { Badge } from "@auction/ui/components/badge";',
    'import { Alert, AlertTitle } from "@auction/ui/components/alert";',
    'import { Tabs, TabsList } from "@auction/ui/components/tabs";',
    'import { Input } from "@auction/ui/components/input";',
  ].join("\n");
  assert.deepEqual(olderElementsImported("app/(marketing)/page.tsx", text), [
    "Alert",
    "Badge",
    "Input",
    "Tabs",
  ]);
});

test("allows the kit, other shared helpers and the older Button outside the public site", () => {
  assert.deepEqual(
    olderElementsImported(
      "components/marketing/a.tsx",
      'import { Button } from "@auction/ui/lax";\nimport { cn, DisplayHeading } from "@auction/ui";',
    ),
    [],
  );
  assert.deepEqual(olderElementsImported("components/dashboard/a.tsx", oldButton), []);
  assert.deepEqual(olderElementsImported("components/sections/checkout/a.tsx", oldButton), []);
  assert.deepEqual(olderElementsImported("components/marketing/a.test.tsx", oldButton), []);
});

test("covers the header chrome files and not the workspace shell", () => {
  assert.equal(isPublicFile("components/layout/header-search.tsx"), true);
  assert.equal(isPublicFile("components/layout/shell-user-menu.tsx"), false);
});
