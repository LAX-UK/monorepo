import { describeAlertStoreContract } from "./contract.js";
import { MemoryAlertStores } from "./memory-stores.js";

describeAlertStoreContract("in memory", "bid", async () => {
  const stores = new MemoryAlertStores();
  return {
    subscribers: stores,
    topics: stores,
    matches: stores,
    digests: stores,
    announcements: stores,
  };
});
