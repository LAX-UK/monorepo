import { beforeEach, describe, expect, it } from "vitest";
import { testAtgConfig } from "./__fixtures__/atg-snapshots.js";
import { FakeAtgGateway } from "./__fixtures__/fakes.js";
import { checkAtgConfig } from "./atg-config-check.js";
import { AtgGatewayError } from "./atg-gateway.js";

describe("checkAtgConfig", () => {
  let gateway: FakeAtgGateway;

  beforeEach(() => {
    gateway = new FakeAtgGateway();
    gateway.incrementSets = [{ incrementSetId: "INC-1", name: "Default" }];
    gateway.supportedCategories = ["Fine Art", "Jewellery"];
  });

  it("reports nothing when both values are known to ATG", async () => {
    expect(await checkAtgConfig(gateway, testAtgConfig)).toEqual({
      problems: [],
      unavailable: [],
      warnings: [],
    });
  });

  it("names an increment set the client does not have", async () => {
    gateway.incrementSets = [{ incrementSetId: "other", name: null }];

    const { problems } = await checkAtgConfig(gateway, testAtgConfig);

    expect(problems).toEqual([expect.stringContaining("ATG_INCREMENT_SET_ID inc-1")]);
  });

  it("names a category the platform does not support", async () => {
    const { problems } = await checkAtgConfig(gateway, {
      ...testAtgConfig,
      defaultCategory: "Cars",
    });

    expect(problems).toEqual([expect.stringContaining('ATG_DEFAULT_CATEGORY "Cars"')]);
  });

  it("treats network failures as unavailable, not as a wrong value", async () => {
    gateway.failNext("getIncrementSets", new AtgGatewayError("down", true, null, "x"));
    gateway.failNext("getSupportedCategories", new AtgGatewayError("down", true, null, "x"));

    const result = await checkAtgConfig(gateway, testAtgConfig);

    expect(result.problems).toEqual([]);
    expect(result.unavailable).toHaveLength(2);
  });

  describe("default internet surcharge", () => {
    it("warns when ATG's client default differs from the surcharge LAX sends", async () => {
      gateway.clientSurchargeRates = { defaultRate: 5, alternativeRate: 4 };

      const { warnings, problems } = await checkAtgConfig(gateway, testAtgConfig);

      expect(problems).toEqual([]);
      expect(warnings).toEqual([
        "ATG's internet surcharge for this client is default 5, alternative 4, but ATG_AUCTION_FEES sends 3 on timed auctions.",
      ]);
    });

    it("stays quiet when the default matches, within tolerance", async () => {
      gateway.clientSurchargeRates = { defaultRate: 3 + 1e-9, alternativeRate: null };

      expect((await checkAtgConfig(gateway, testAtgConfig)).warnings).toEqual([]);
    });

    it("stays quiet when ATG holds no default", async () => {
      expect((await checkAtgConfig(gateway, testAtgConfig)).warnings).toEqual([]);
    });

    it("treats a failed read as unavailable, not as a mismatch", async () => {
      gateway.failNext("getClientSurchargeRates", new AtgGatewayError("down", true, null, "x"));

      const result = await checkAtgConfig(gateway, testAtgConfig);

      expect(result.warnings).toEqual([]);
      expect(result.unavailable).toEqual([expect.stringContaining("Default internet surcharge")]);
    });
  });

  it("skips the increment set check without a client id", async () => {
    const result = await checkAtgConfig(gateway, { ...testAtgConfig, clientId: null });

    expect(gateway.ops()).toEqual(["getSupportedCategories"]);
    expect(result.unavailable).toEqual([expect.stringContaining("ATG_CLIENT_ID")]);
  });
});
