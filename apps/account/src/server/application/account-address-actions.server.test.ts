import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = {
  createAddress: vi.fn(),
  updateAddress: vi.fn(),
  deleteAddress: vi.fn(),
  setDefaultAddress: vi.fn(),
};
const loadAccountRecord = vi.fn();

vi.mock("../container", () => ({ getLaxAccountContainer: () => ({ identity }) }));
vi.mock("./load-account-record", () => ({ loadAccountRecord: () => loadAccountRecord() }));

const { addAddressAction, deleteAddressAction, setDefaultAddressAction, updateAddressAction } =
  await import("./account-identity-actions.server");

const ACTOR = { accessToken: "access-token", sid: "current-sid" };
const ID = "33333333-3333-4333-8333-333333333333";
const INPUT = {
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: null,
  postcode: "SW1A 1AA",
  country: "GB",
  phone: null,
};

describe("address actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadAccountRecord.mockResolvedValue({ ...ACTOR, subject: "subject" });
  });

  it("adds, updates and deletes as the signed-in person", async () => {
    identity.createAddress.mockResolvedValue({ status: "ok", value: {} });
    identity.updateAddress.mockResolvedValue({ status: "ok", value: {} });
    identity.deleteAddress.mockResolvedValue({ status: "ok", value: true });
    expect(await addAddressAction(INPUT)).toMatchObject({ status: "ok" });
    expect(await updateAddressAction(ID, 3, INPUT)).toMatchObject({ status: "ok" });
    expect(await deleteAddressAction(ID, 3)).toMatchObject({ status: "ok" });
    expect(identity.createAddress).toHaveBeenCalledWith(ACTOR, INPUT);
    expect(identity.updateAddress).toHaveBeenCalledWith(ACTOR, ID, 3, INPUT);
    expect(identity.deleteAddress).toHaveBeenCalledWith(ACTOR, ID, 3);
  });

  it("refuses an invalid address before calling the issuer", async () => {
    expect(await addAddressAction({ ...INPUT, country: "Narnia" })).toMatchObject({
      status: "error",
    });
    expect(await updateAddressAction(ID, 1, { ...INPUT, postcode: "nope" })).toMatchObject({
      status: "error",
    });
    expect(identity.createAddress).not.toHaveBeenCalled();
    expect(identity.updateAddress).not.toHaveBeenCalled();
  });

  it("sends the person through a fresh sign-in when the issuer asks for one", async () => {
    identity.createAddress.mockResolvedValue({ status: "reauth_required" });
    expect(await addAddressAction(INPUT)).toEqual({ status: "reauth_required" });
  });

  it("explains a stale edit and the address limit", async () => {
    identity.updateAddress.mockResolvedValue({ status: "rejected", reason: "version_conflict" });
    identity.createAddress.mockResolvedValue({
      status: "rejected",
      reason: "address_limit_reached",
    });
    expect(await updateAddressAction(ID, 1, INPUT)).toEqual({
      status: "error",
      message: expect.stringContaining("changed somewhere else"),
    });
    expect(await addAddressAction(INPUT)).toEqual({
      status: "error",
      message: expect.stringContaining("up to 20"),
    });
  });

  it("makes a default of the chosen kind and rejects an unknown kind", async () => {
    identity.setDefaultAddress.mockResolvedValue({ status: "ok", value: {} });
    expect(await setDefaultAddressAction(ID, "billing")).toEqual({
      status: "ok",
      message: "Default billing address updated.",
    });
    expect(identity.setDefaultAddress).toHaveBeenCalledWith(ACTOR, ID, "billing");
    expect(await setDefaultAddressAction(ID, "both" as never)).toMatchObject({ status: "error" });
  });

  it("asks for a sign-in, without calling the issuer, when nobody is signed in", async () => {
    loadAccountRecord.mockResolvedValue(null);
    expect(await deleteAddressAction(ID, 1)).toEqual({ status: "reauth_required" });
    expect(identity.deleteAddress).not.toHaveBeenCalled();
  });
});
