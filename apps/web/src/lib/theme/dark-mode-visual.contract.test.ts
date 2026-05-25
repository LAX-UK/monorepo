import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { auditDarkMode, loadExemptions } from "./audit-dark-mode";

const repoRoot = join(__dirname, "../../../../..");

describe("dark mode visual contract", () => {
  it("has no unallowlisted unpaired light-only class suspects", () => {
    const exemptions = loadExemptions(repoRoot);
    const suspects = auditDarkMode({ repoRoot, exemptions });

    if (suspects.length > 0) {
      const summary = suspects
        .slice(0, 20)
        .map((item) => `${item.file}:${item.line} (${item.token})`)
        .join("\n");
      const suffix = suspects.length > 20 ? `\n… and ${suspects.length - 20} more` : "";
      expect.fail(
        `Found ${suspects.length} unpaired light-only class suspect(s):\n${summary}${suffix}`,
      );
    }

    expect(suspects).toEqual([]);
  });
});
