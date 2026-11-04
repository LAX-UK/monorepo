import type { Certificate, EditionFacts } from "@auction/shop-domain";
import { describe, expect, it } from "vitest";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createInMemoryPrintFulfilment } from "../../test-support/in-memory-print-fulfilment.js";
import { createPrintFulfilmentServices } from "./print-fulfilment-services.js";

const NOW = new Date("2026-11-04T10:00:00.000Z");
const ACTOR = "staff-pat";
let keys = 0;
const staff = () => ({ actorSubjectId: ACTOR, idempotencyKey: `key-${++keys}` });

function factsWith(certificate: Certificate, numbering: EditionFacts["numbering"] = "on_print") {
  return {
    numbering,
    signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
    certificate,
    confirmed: { by: "staff-sara", at: NOW },
  } satisfies EditionFacts;
}

const laxDigital: Certificate = {
  kind: "included",
  issuer: "lax",
  form: "digital",
  arrives: { kind: "with_print" },
  numberedToMatch: true,
};
const artistPaper: Certificate = { ...laxDigital, issuer: "artist", form: "paper" };

function setup(
  options: {
    certificate?: Certificate;
    numbering?: EditionFacts["numbering"];
    authority?: boolean;
    laxCertificates?: boolean;
  } = {},
) {
  const memory = createInMemoryPrintFulfilment({
    facts: factsWith(options.certificate ?? artistPaper, options.numbering),
    authority: options.authority ? { reference: "Letter of 3 Oct", recordedAt: NOW } : null,
    laxParties: ["lax"],
  });
  for (const stockRef of [7, 8, 9, 10]) memory.addPrint({ stockRef });
  memory.addPrint({ stockRef: 21, ownerPartyId: "lax" });
  const services = createPrintFulfilmentServices({
    uow: memory.uow,
    pickList: memory.pickList,
    staffNames: { namesFor: async () => new Map([[ACTOR, "Pat Jones"]]) },
    certificateSettings: { laxCertificatesEnabled: () => options.laxCertificates ?? false },
    clock: { now: () => NOW },
  });
  return { memory, services };
}

describe("confirming the print in hand", () => {
  it("records who confirmed it and when, on a matching typed label", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const result = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: " 7/24 " },
    });
    expect(result).toMatchObject({ outcome: "confirmed", label: "7/24" });
    expect(memory.lines.get(line.orderLineId)).toMatchObject({
      confirmedBy: ACTOR,
      confirmedAt: NOW,
    });
    expect(memory.events.map((e) => e.kind)).toContain("pack_confirmed");
    expect(memory.audit.at(-1)).toMatchObject({
      action: "confirm_print",
      capability: "fulfilment.write",
    });
  });

  it("matches the scanned stock label", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const result = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "label_code", value: "code7" },
    });
    expect(result.outcome).toBe("confirmed");
  });

  it("changes nothing when another print is in hand and says what to do", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const wrong = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "99/24" },
    });
    expect(wrong).toMatchObject({ outcome: "wrong_print" });
    const free = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "9/24" },
    });
    expect(free).toMatchObject({
      outcome: "swap_available",
      needsAdmin: false,
      to: { editionId: "e9", label: "9/24" },
    });
    const otherOwner = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "21/24" },
    });
    expect(otherOwner).toMatchObject({ outcome: "swap_available", needsAdmin: true });
    expect(memory.lines.get(line.orderLineId)?.confirmedAt).toBeNull();
    expect(memory.certificates).toHaveLength(0);
  });

  it("treats a second confirmation as the first", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const command = {
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label" as const, value: "7/24" },
    };
    await services.confirm.confirm({ ...staff(), ...command });
    await services.confirm.confirm({ ...staff(), ...command });
    expect(memory.events.filter((e) => e.kind === "pack_confirmed")).toHaveLength(1);
    expect(memory.certificates).toHaveLength(1);
  });

  it("refuses an unpaid or cancelled line", async () => {
    const { memory, services } = setup();
    const unpaid = memory.sell(7, { paid: false });
    const cancelled = memory.sell(8, { released: true });
    for (const line of [unpaid, cancelled]) {
      await expect(
        services.confirm.confirm({
          ...staff(),
          orderLineId: line.orderLineId,
          scanned: { source: "typed_label", value: "7/24" },
        }),
      ).rejects.toBeInstanceOf(ShopApiError);
    }
  });

  it("answers not found for a line that does not exist", async () => {
    const { services } = setup();
    await expect(
      services.confirm.confirm({
        ...staff(),
        orderLineId: "nope",
        scanned: { source: "typed_label", value: "7/24" },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("the certificate a confirmed print gets", () => {
  it("records a paper certificate as issued with the print", async () => {
    const { memory, services } = setup({ certificate: artistPaper });
    const line = memory.sell(7);
    const result = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "7/24" },
    });
    expect(result).toMatchObject({ certificate: { status: "issued" } });
    expect(memory.certificates[0]).toMatchObject({ printLabel: "7/24", issuedAt: NOW });
  });

  it("holds a LAX digital certificate on the to-send list while the setting is off", async () => {
    const { memory, services } = setup({ certificate: laxDigital, authority: true });
    const line = memory.sell(7);
    const result = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "7/24" },
    });
    expect(result).toMatchObject({ certificate: { status: "to_send" } });
    const queue = await services.certificates.listToSend();
    expect(queue.items).toHaveLength(1);
    const sent = await services.certificates.markSent({
      ...staff(),
      certificateId: memory.certificates[0]?.certificateId ?? "",
    });
    expect(sent.issuedAt).toBe(NOW.toISOString());
    expect((await services.certificates.listToSend()).items).toHaveLength(0);
  });

  it("issues a LAX digital certificate at once when the setting is on and authority is recorded", async () => {
    const { memory, services } = setup({
      certificate: laxDigital,
      authority: true,
      laxCertificates: true,
    });
    const line = memory.sell(7);
    const result = await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "7/24" },
    });
    expect(result).toMatchObject({ certificate: { status: "issued" } });
    expect(memory.certificates[0]).toMatchObject({ issuer: "lax", issuedAt: NOW });
  });

  it("will not pack a print whose LAX certificate has no artist authority on record", async () => {
    const { memory, services } = setup({ certificate: laxDigital, laxCertificates: true });
    const line = memory.sell(7);
    await expect(
      services.confirm.confirm({
        ...staff(),
        orderLineId: line.orderLineId,
        scanned: { source: "typed_label", value: "7/24" },
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringMatching(/written authority/),
    });
    expect(memory.lines.get(line.orderLineId)?.confirmedAt).toBeNull();
  });

  it("records the authority once the facts exist, and refuses an empty reference", async () => {
    const { memory, services } = setup({ certificate: laxDigital });
    await services.certificates.recordAuthority({
      ...staff(),
      artworkId: "art1",
      reference: "  Estate letter, 3 Oct 2026 ",
    });
    expect(memory.state.authority?.reference).toBe("Estate letter, 3 Oct 2026");
    await expect(
      services.certificates.recordAuthority({ ...staff(), artworkId: "art1", reference: "  " }),
    ).rejects.toThrow(/written authority/);
  });
});

describe("sending another print in place of the one sold", () => {
  it("sends the next free print the same owner holds, sets the first aside and tells the buyer", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const result = await services.swap.swap({
      ...staff(),
      orderLineId: line.orderLineId,
      toEditionId: undefined,
      reason: "Corner creased",
      canSwapAcrossOwners: false,
    });
    expect(result).toEqual({
      label: "8/24",
      previousLabel: "7/24",
      payoutMoved: false,
      buyerNotified: true,
    });
    expect(memory.prints.get("e7")).toMatchObject({ listingStatus: "withdrawn" });
    expect(memory.prints.get("e8")).toMatchObject({ listingStatus: "sold", ownerPartyId: "buyer" });
    expect(memory.lines.get(line.orderLineId)?.printId).toBe("e8");
    expect(memory.events.map((e) => e.kind)).toEqual(["print_set_aside", "print_sent_instead"]);
    expect(memory.notices).toEqual([
      expect.objectContaining({
        newLabel: "8/24",
        previousLabel: "7/24",
        orderReference: "LAX-S-10482",
      }),
    ]);
  });

  it("does not email the buyer about a run that is not numbered", async () => {
    const { memory, services } = setup({ numbering: "none" });
    const line = memory.sell(7);
    const result = await services.swap.swap({
      ...staff(),
      orderLineId: line.orderLineId,
      toEditionId: undefined,
      reason: "Damaged in the drawer",
      canSwapAcrossOwners: false,
    });
    expect(result.buyerNotified).toBe(false);
    expect(memory.notices).toHaveLength(0);
  });

  it("sends the chosen print", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    const result = await services.swap.swap({
      ...staff(),
      orderLineId: line.orderLineId,
      toEditionId: "e10",
      reason: "Customer asked for a later number",
      canSwapAcrossOwners: false,
    });
    expect(result.label).toBe("10/24");
  });

  it("refuses a print that is not free or not in the run", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    memory.sell(8);
    const base = {
      orderLineId: line.orderLineId,
      reason: "Damaged",
      canSwapAcrossOwners: false,
    };
    await expect(services.swap.swap({ ...staff(), ...base, toEditionId: "e8" })).rejects.toThrow(
      /not free/,
    );
    await expect(
      services.swap.swap({ ...staff(), ...base, toEditionId: "elsewhere" }),
    ).rejects.toThrow(/not part of this run/);
  });

  it("needs a reason, and refuses once the print is packed", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    await expect(
      services.swap.swap({
        ...staff(),
        orderLineId: line.orderLineId,
        toEditionId: undefined,
        reason: " ",
        canSwapAcrossOwners: false,
      }),
    ).rejects.toThrow(/why/);
    await services.confirm.confirm({
      ...staff(),
      orderLineId: line.orderLineId,
      scanned: { source: "typed_label", value: "7/24" },
    });
    await expect(
      services.swap.swap({
        ...staff(),
        orderLineId: line.orderLineId,
        toEditionId: undefined,
        reason: "Changed my mind",
        canSwapAcrossOwners: false,
      }),
    ).rejects.toThrow(/already packed/);
  });

  describe("when the replacement has a different owner", () => {
    function onlyLaxLeft() {
      const context = setup();
      for (const id of ["e8", "e9", "e10"]) {
        const print = context.memory.prints.get(id);
        if (print) print.listingStatus = "sold";
      }
      return context;
    }

    it("is for shop admins only", async () => {
      const { memory, services } = onlyLaxLeft();
      const line = memory.sell(7);
      await expect(
        services.swap.swap({
          ...staff(),
          orderLineId: line.orderLineId,
          toEditionId: undefined,
          reason: "Missing",
          canSwapAcrossOwners: false,
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(memory.lines.get(line.orderLineId)?.printId).toBe("e7");
    });

    it("moves the seller, drops the artist's payout and audits it under the admin capability", async () => {
      const { memory, services } = onlyLaxLeft();
      const line = memory.sell(7);
      expect(memory.payouts.get(line.orderLineId)).toMatchObject({ ownerPartyId: "artist" });
      const result = await services.swap.swap({
        ...staff(),
        orderLineId: line.orderLineId,
        toEditionId: undefined,
        reason: "Missing",
        canSwapAcrossOwners: true,
      });
      expect(result).toMatchObject({ label: "21/24", payoutMoved: true });
      expect(memory.lines.get(line.orderLineId)?.sellerPartyId).toBe("lax");
      expect(memory.payouts.has(line.orderLineId)).toBe(false);
      expect(memory.audit.at(-1)).toMatchObject({
        capability: "print_swap.cross_owner",
        action: "swap_print",
      });
    });
  });
});

describe("the pick list", () => {
  it("lists each print with where it is, who confirmed it and its certificate", async () => {
    const { memory, services } = setup({ certificate: artistPaper });
    const stored = memory.sell(7);
    const pending = memory.sell(8);
    const prints = memory.prints;
    const print = prints.get("e7");
    if (print) print.storageLocation = "Plan chest B, drawer 3";
    await services.confirm.confirm({
      ...staff(),
      orderLineId: stored.orderLineId,
      scanned: { source: "typed_label", value: "7/24" },
    });
    const list = await services.pickAndPack.forOrder("order1");
    expect(list.lines).toHaveLength(2);
    expect(list.lines.find((l) => l.orderLineId === stored.orderLineId)).toMatchObject({
      label: "7/24",
      numbered: true,
      storageLocation: "Plan chest B, drawer 3",
      printedToOrder: false,
      confirmedBy: "Pat Jones",
      certificate: { status: "issued" },
    });
    expect(list.lines.find((l) => l.orderLineId === pending.orderLineId)).toMatchObject({
      label: "8/24",
      confirmedAt: null,
      certificate: { status: "pending_confirmation" },
    });
  });

  it("warns before packing when a LAX certificate cannot be issued", async () => {
    const { memory, services } = setup({ certificate: laxDigital });
    memory.sell(7);
    const list = await services.pickAndPack.forOrder("order1");
    expect(list.lines[0]?.certificate).toMatchObject({ status: "blocked" });
  });

  it("shows a print that was sent in place of another", async () => {
    const { memory, services } = setup();
    const line = memory.sell(7);
    await services.swap.swap({
      ...staff(),
      orderLineId: line.orderLineId,
      toEditionId: undefined,
      reason: "Creased",
      canSwapAcrossOwners: false,
    });
    const list = await services.pickAndPack.forOrder("order1");
    expect(list.lines[0]).toMatchObject({ label: "8/24", replacedLabel: "7/24" });
  });
});

describe("approving a hors commerce proof", () => {
  it("approves once, keeps the first approval, and only for hors commerce listings", async () => {
    const { memory, services } = setup();
    memory.hc.set("hc1", { artworkId: "hc1", proofType: "hc", approvedAt: null, approvedBy: null });
    memory.hc.set("ap1", { artworkId: "ap1", proofType: "ap", approvedAt: null, approvedBy: null });
    const first = await services.certificates.approveHorsCommerce({
      ...staff(),
      artworkId: "hc1",
    });
    expect(first).toEqual({ approvedAt: NOW.toISOString(), approvedBy: ACTOR });
    const again = await services.certificates.approveHorsCommerce({
      ...staff(),
      actorSubjectId: "someone-else",
      artworkId: "hc1",
    });
    expect(again.approvedBy).toBe(ACTOR);
    await expect(
      services.certificates.approveHorsCommerce({ ...staff(), artworkId: "ap1" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      services.certificates.approveHorsCommerce({ ...staff(), artworkId: "missing" }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(memory.audit.filter((a) => a.action === "approve_hors_commerce")).toHaveLength(1);
  });
});
