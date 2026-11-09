import type { AdminEditionFacts } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import { createInMemoryEditionRuns } from "../../test-support/in-memory-edition-runs.js";
import { editionFactsInput } from "./edition-run-input.js";
import { createEditionRunServices } from "./edition-run-services.js";

const NOW = new Date("2026-11-09T09:00:00.000Z");
const ACTOR = "staff-sara";

const LAX_CERTIFICATE_FACTS: AdminEditionFacts = {
  numbering: "on_print",
  signature: { kind: "hand_signed", medium: "pencil", place: "front_lower_margin" },
  certificate: {
    kind: "included",
    issuer: "lax",
    form: "paper",
    arrives: { kind: "with_print" },
    numberedToMatch: true,
    authority: {
      givenBy: "artist",
      datedOn: "2026-09-12",
      reference: "Signed letter in the artist file",
    },
  },
  stamp: "printer_blind",
  printedBy: " Coriander Studio, London ",
  publishedBy: { kind: "named", name: "Kestrel Editions" },
};

let keys = 0;
const staff = () => ({ actorSubjectId: ACTOR, idempotencyKey: `key-${++keys}` });

async function setup(options: { laxCertificatesEnabled?: boolean } = {}) {
  const memory = createInMemoryEditionRuns();
  const services = createEditionRunServices({
    uow: memory.uow,
    clock: { now: () => NOW },
    ...(options.laxCertificatesEnabled ? { laxCertificatesEnabled: () => true } : {}),
  });
  memory.addArtwork({ artworkId: "run", sourceOriginalArtworkId: null });
  await services.recorder.recordNewRun({} as never, {
    artworkId: "run",
    artistId: "artist-1",
    sourceOriginalArtworkId: null,
    run: { spec: { type: "lax_standard" } },
    actorSubjectId: ACTOR,
  });
  return { memory, services };
}

const save = (
  context: Awaited<ReturnType<typeof setup>>,
  facts: AdminEditionFacts,
  confirmed = true,
) =>
  context.services.facts.save({
    ...staff(),
    artworkId: "run",
    facts: editionFactsInput(facts),
    confirmed,
    expectedFactsVersion: context.memory.facts.get("run")?.version ?? null,
  });

describe("saving the stamp, printer, publisher and certificate authority", () => {
  it("stores them with the facts, names trimmed", async () => {
    const context = await setup({ laxCertificatesEnabled: true });
    await save(context, LAX_CERTIFICATE_FACTS);
    expect(context.memory.facts.get("run")?.facts).toMatchObject({
      stamp: "printer_blind",
      printedBy: "Coriander Studio, London",
      publishedBy: { kind: "named", name: "Kestrel Editions" },
      certificate: {
        issuer: "lax",
        authority: { givenBy: "artist", datedOn: "2026-09-12" },
      },
    });
  });

  it("keeps a certificate London Art Exchange issues behind the certificates flag", async () => {
    const context = await setup();
    await expect(save(context, LAX_CERTIFICATE_FACTS)).rejects.toThrow(
      "Certificates issued by London Art Exchange are not switched on yet",
    );
    expect(context.memory.facts.has("run")).toBe(false);
  });

  it("refuses a certificate London Art Exchange issues without the authority on file", async () => {
    const context = await setup({ laxCertificatesEnabled: true });
    const { authority: _removed, ...certificate } =
      LAX_CERTIFICATE_FACTS.certificate.kind === "included"
        ? LAX_CERTIFICATE_FACTS.certificate
        : { kind: "included" as const };
    await expect(
      save(context, {
        ...LAX_CERTIFICATE_FACTS,
        certificate: certificate as AdminEditionFacts["certificate"],
      }),
    ).rejects.toThrow("written authority");
  });

  it("does not ask the artist's own certificate for an authority", async () => {
    const context = await setup();
    await save(context, {
      ...LAX_CERTIFICATE_FACTS,
      certificate: {
        kind: "included",
        issuer: "artist",
        form: "paper",
        arrives: { kind: "with_print" },
        numberedToMatch: true,
      },
    });
    expect(context.memory.facts.get("run")?.facts.certificate).toMatchObject({ issuer: "artist" });
  });

  it("says nothing about a stamp or parties that are left out", async () => {
    const context = await setup();
    await save(context, {
      numbering: "none",
      signature: { kind: "unsigned" },
      certificate: { kind: "none" },
    });
    expect(context.memory.facts.get("run")?.facts).toMatchObject({
      stamp: "none",
      printedBy: null,
      publishedBy: null,
    });
  });
});
