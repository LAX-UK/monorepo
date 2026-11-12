import { describe, expect, it } from "vitest";
import { createClientHarness, runZohoBooksClientContract } from "./testing/index.js";

runZohoBooksClientContract({ describe, it, expect }, () => createClientHarness());
