import { describe, expect, it } from "vitest";
import {
  createAdapterHarness,
  createFakeSubject,
  runAccountingContract,
} from "../testing/index.js";

describe("in-memory fake", () => {
  runAccountingContract({ describe, it, expect }, createFakeSubject);
});

describe("Books adapter over the simulated Books", () => {
  runAccountingContract({ describe, it, expect }, createAdapterHarness);
});
