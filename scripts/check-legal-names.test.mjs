import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPANY_NAME,
  RETIRED_PRODUCT_NAME,
  findNameHits,
  isExempt,
} from "./check-legal-names.mjs";

test("flags a typed company name with its line", () => {
  const hits = findNameHits('ok\nconst n = "London Auction Xchange LTD";\n', COMPANY_NAME);
  assert.deepEqual(hits, [{ line: 2, text: 'const n = "London Auction Xchange LTD";' }]);
});

test("flags both registered suffix casings of London Art Exchange", () => {
  assert.equal(findNameHits("London Art Exchange Ltd", COMPANY_NAME).length, 1);
  assert.equal(findNameHits("london art exchange limited", COMPANY_NAME).length, 1);
});

test("ignores comment lines", () => {
  assert.deepEqual(
    findNameHits("// London Auction Xchange LTD\n * London Auction Xchange", COMPANY_NAME),
    [],
  );
});

test("flags the retired gallery name but not London Art Exchange as a product", () => {
  assert.equal(findNameHits("Visit LAX Art today", RETIRED_PRODUCT_NAME).length, 1);
  assert.deepEqual(findNameHits("LAX Art Exchange", RETIRED_PRODUCT_NAME), []);
});

test("exempts tests, verbatim policies and the identity mirror", () => {
  assert.equal(isExempt("apps/web/src/a.test.ts"), true);
  assert.equal(isExempt("packages/marketing-ui/src/legal/london-art-exchange/terms.ts"), true);
  assert.equal(isExempt("packages/identity-contracts/src/legal-documents.ts"), true);
  assert.equal(isExempt("packages/accounting-domain/src/document.ts"), true);
  assert.equal(isExempt("packages/accounting-domain/src/lifecycle.ts"), false);
  assert.equal(isExempt("apps/web/src/footer.tsx"), false);
});
