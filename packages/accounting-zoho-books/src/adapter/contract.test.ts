import { describe, expect, it } from "vitest";
import {
  createAdapterHarness,
  createFakeSubject,
  runAccountingContract,
  runDocumentPdfContract,
  testOrgConfigs,
} from "../testing/index.js";
import { createZohoBooksDryRunAdapter } from "./dry-run.js";

describe("in-memory fake", () => {
  runAccountingContract({ describe, it, expect }, createFakeSubject);
});

describe("Books adapter over the simulated Books", () => {
  runAccountingContract({ describe, it, expect }, createAdapterHarness);
});

describe("stored copy: in-memory fake", () => {
  runDocumentPdfContract({ describe, it, expect }, () => ({
    ports: createFakeSubject().ports,
    rehearsal: false,
  }));
});

describe("stored copy: rehearsal (dry run)", () => {
  runDocumentPdfContract({ describe, it, expect }, () => ({
    ports: createZohoBooksDryRunAdapter({ orgs: testOrgConfigs() }),
    rehearsal: true,
  }));
});
