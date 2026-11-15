import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchApi = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("@/lib/data/container.server", () => ({ getServerDataContainer: vi.fn() }));
vi.mock("@/lib/data/http/authed-fetch.server", () => ({ authedServerFetch: fetchApi }));

import { saveDeliveryAddressAction } from "./purchase.actions";

const ORG = "11111111-1111-4111-8111-111111111111";
const ADDRESS = {
  line1: "7 Dock Road",
  line2: "",
  city: "Bristol",
  region: "",
  postalCode: "BS1 4XX",
  country: "gb",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

beforeEach(() => fetchApi.mockReset());

describe("saveDeliveryAddressAction", () => {
  it("adds to the organisation, acting as it, and hands the address back for the picker", async () => {
    fetchApi.mockResolvedValue(
      json(201, {
        data: {
          id: "d1",
          kind: "delivery",
          line1: "7 Dock Road",
          line2: null,
          city: "Bristol",
          region: null,
          postalCode: "BS1 4XX",
          country: "GB",
        },
      }),
    );
    const result = await saveDeliveryAddressAction("ignored", ADDRESS, ORG);
    const [path, init] = fetchApi.mock.calls[0] ?? [];
    expect(path).toBe("/legal-entities/addresses");
    expect(init.headers[X_LEGAL_ENTITY_ID_HEADER]).toBe(ORG);
    expect(JSON.parse(init.body)).toEqual({
      line1: "7 Dock Road",
      line2: null,
      city: "Bristol",
      region: null,
      postalCode: "BS1 4XX",
      country: "GB",
    });
    expect(result).toMatchObject({
      ok: true,
      address: { id: "organisation-d1", label: "Delivery address" },
    });
  });

  it("saves to the member's own address book when no organisation is named", async () => {
    fetchApi.mockResolvedValue(json(500, {}));
    await saveDeliveryAddressAction("Studio", ADDRESS);
    expect(fetchApi.mock.calls[0]?.[0]).toBe("/users/me/addresses");
    expect(fetchApi.mock.calls[0]?.[1].headers).not.toHaveProperty(X_LEGAL_ENTITY_ID_HEADER);
  });

  it("tells a read-only role it cannot add, and never calls the API for a bad organisation id", async () => {
    fetchApi.mockResolvedValue(json(403, { error: "forbidden" }));
    expect(await saveDeliveryAddressAction("", ADDRESS, ORG)).toEqual({
      ok: false,
      message: "Your role can't add addresses for this organisation.",
    });
    fetchApi.mockClear();
    expect((await saveDeliveryAddressAction("", ADDRESS, "not-a-uuid")).ok).toBe(false);
    expect(fetchApi).not.toHaveBeenCalled();
  });
});
