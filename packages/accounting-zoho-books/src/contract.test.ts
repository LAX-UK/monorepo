import { describe, expect, it } from "vitest";
import {
  InMemoryTokenStore,
  createClientHarness,
  runZohoBooksClientContract,
  runZohoTokenStoreContract,
} from "./testing/index.js";

runZohoBooksClientContract({ describe, it, expect }, () => createClientHarness());
runZohoTokenStoreContract({ describe, it, expect }, () => new InMemoryTokenStore());
