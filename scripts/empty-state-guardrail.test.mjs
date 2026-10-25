import assert from "node:assert/strict";
import { test } from "node:test";
import { checkEmptyStateSource } from "./empty-state-guardrail.mjs";

const FILE = "apps/shop/src/components/example.tsx";

test("flags a bare 'No … yet' paragraph", () => {
  const src = `<p className="text-sm text-on-surface-variant">\n  No orders yet.\n</p>`;
  assert.equal(checkEmptyStateSource(FILE, src).length, 1);
});

test("accepts the shared empty state", () => {
  const src = `<EmptyState size="compact" illustration="parcel" title="No orders yet" />`;
  assert.deepEqual(checkEmptyStateSource(FILE, src), []);
});

test("flags an empty state with a small icon, not an action's icon", () => {
  assert.equal(
    checkEmptyStateSource(FILE, `<EmptyState title="No lots" icon={<Gavel aria-hidden />} />`)
      .length,
    1,
  );
  const withActionIcon = `<EmptyState title="No artists" action={<StaffButton icon={<Plus />}>New</StaffButton>} />`;
  assert.deepEqual(checkEmptyStateSource(FILE, withActionIcon), []);
});

test("flags an app-local illustration SVG", () => {
  const src = "function EmptyCartIllustration() {\n  return <svg viewBox='0 0 1 1' />;\n}";
  assert.equal(checkEmptyStateSource(FILE, src).length, 1);
});

test("allows inline hints in listed form repeaters", () => {
  const src = `<p className="text-sm">No exhibitions yet.</p>`;
  assert.deepEqual(
    checkEmptyStateSource(
      "apps/web/src/components/admin/lot-marketing-form/steps/catalog-step.tsx",
      src,
    ),
    [],
  );
});
