import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SUBJECT_EXPORT_CATEGORIES,
  SUBJECT_EXPORT_PRODUCTS,
  subjectExportFileSchema,
} from "@auction/identity-contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArchiveBudget } from "./archive-budget.js";
import { HttpExportFileMaterialiser } from "./export-file-materialiser.js";
import {
  EXPORT_ID,
  FakeArchiveStore,
  FakeFileHost,
  FakeProduct,
  FakeProgress,
  SUBJECT_ID,
  fileRef,
  record,
  text,
  unzip,
} from "./fake-export-world.test-util.js";
import { SubjectExportAssembler, SubjectExportTerminalError } from "./subject-export-assembler.js";
import { SubjectExportError } from "./subject-export.errors.js";

const NOW = new Date("2026-11-02T14:03:11.000Z");
const HOUR = 3_600_000;
const noop = () => undefined;

type World = ReturnType<typeof createWorld>;

function createWorld(tempRoot: string, options: { budget?: () => ArchiveBudget } = {}) {
  const account = new FakeProduct("account", "bearer")
    .set("profile", [record("p1", { name: "Sarah <Whitfield>" })])
    .set("contact", [record("c1", { email: "sarah@example.test" })])
    .set("addresses", [record("a1"), record("a2"), record("a3")]);
  const bid = new FakeProduct("bid", "pair")
    .set("bids", [record("b1"), record("b2"), record("b3"), record("b4"), record("b5")])
    .set("invoices", [
      record("i1", {
        total: { minor: 260000, currency: "GBP" },
        pdf: fileRef("Invoice 1.pdf", 11),
      }),
    ]);
  const shop = new FakeProduct("shop", "pair").set("orders", [record("o1")]);
  const host = new FakeFileHost().put("Invoice 1.pdf", new TextEncoder().encode("PDF-BYTES-01"));
  const progress = new FakeProgress();
  const store = new FakeArchiveStore();
  const assembler = new SubjectExportAssembler({
    sources: { account: account.source(), bid: bid.source(), shop: shop.source() },
    progress,
    store,
    log: { info: noop, warn: noop },
    tempRoot,
    now: () => NOW,
    ...(options.budget ? { createBudget: options.budget } : {}),
    createFiles: (staging, budget) =>
      new HttpExportFileMaterialiser({ staging, budget, fetchImpl: host.fetch }),
  });
  return { account, bid, shop, host, progress, store, assembler };
}

const request = { exportId: EXPORT_ID, subjectId: SUBJECT_ID };
const firstAttempt = (queuedAt = NOW) => ({ number: 1, maxAttempts: 13, queuedAt });

let tempRoot: string;
beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "subject-export-test-"));
});
afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

async function readyZip(world: World) {
  const key = `subject-exports/${EXPORT_ID}/lax-data-2026-11-02.zip`;
  const archive = world.store.objects.get(key);
  expect(archive, "the archive was uploaded under the request's folder").toBeDefined();
  return { key, archive: archive as Buffer, entries: unzip(archive as Buffer) };
}

describe("the happy path", () => {
  it("collects every product, uploads one ZIP and reports ready", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());

    expect(
      world.progress.reports.map((r) => (r.event === "product_collected" ? r.product : r.event)),
    ).toEqual(["account", "bid", "shop", "ready"]);
    const { key, archive, entries } = await readyZip(world);
    const ready = world.progress.reports.at(-1);
    expect(ready).toEqual({
      event: "ready",
      objectKey: key,
      fileName: "lax-data-2026-11-02.zip",
      sizeBytes: archive.length,
      sha256: createHash("sha256").update(archive).digest("hex"),
    });

    const root = "lax-data-2026-11-02";
    const paths = Object.keys(entries).map((path) => path.replace(`${root}/`, ""));
    expect(paths).toEqual(
      expect.arrayContaining(["Your LAX data.html", "README.txt", "manifest.json"]),
    );
    for (const product of SUBJECT_EXPORT_PRODUCTS) {
      for (const category of SUBJECT_EXPORT_CATEGORIES[product]) {
        expect(paths).toContain(`${product}/${category.id}.json`);
      }
    }
  });

  it("pages every category with the cursor and writes the shared envelope", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);

    const bids = subjectExportFileSchema.parse(
      JSON.parse(text(entries["lax-data-2026-11-02/bid/bids.json"])),
    );
    expect(bids).toMatchObject({
      schema: "lax.subject-export/bid/bids@1",
      product: "LAX Bid",
      controller: "London Auction Xchange LTD",
      generatedAt: NOW.toISOString(),
    });
    expect(bids.records.map((r) => r.id)).toEqual(["b1", "b2", "b3", "b4", "b5"]);
    // 5 records at 2 a page: three requests, the last without a next cursor.
    expect(world.bid.requests.filter((r) => r.includes("/export/bids"))).toEqual([
      "GET /internal/identity/subjects/subject-1/export/bids",
      "GET /internal/identity/subjects/subject-1/export/bids?cursor=2",
      "GET /internal/identity/subjects/subject-1/export/bids?cursor=4",
    ]);
  });

  it("states an empty category instead of leaving it out", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);
    const empty = JSON.parse(text(entries["lax-data-2026-11-02/shop/basket.json"]));
    expect(empty.records).toEqual([]);
    expect(subjectExportFileSchema.safeParse(empty).success).toBe(true);
    // The product was never asked for a category it does not list.
    expect(world.shop.requests.some((r) => r.includes("/export/basket"))).toBe(false);
  });

  it("reports each product with its category counts, never record content", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const bidReport = world.progress.reports.find(
      (r) => r.event === "product_collected" && r.product === "bid",
    );
    expect(bidReport).toMatchObject({
      categories: expect.arrayContaining([
        { id: "bids", schemaVersion: 1, count: 5 },
        { id: "invoices", schemaVersion: 1, count: 1 },
        { id: "watchlist-and-alerts", schemaVersion: 1, count: 0 },
      ]),
    });
    expect(JSON.stringify(world.progress.reports)).not.toContain("sarah@example.test");
  });

  it("asks Identity for one token and reuses it across its routes", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    expect(world.account.tokenRequests).toBe(1);
  });

  it("refreshes a token Identity no longer accepts, once", async () => {
    const world = createWorld(tempRoot);
    const source = world.account.source();
    await source.manifest(SUBJECT_ID, AbortSignal.timeout(5_000));
    world.account.rotateTokens();
    await source.manifest(SUBJECT_ID, AbortSignal.timeout(5_000));
    expect(world.account.tokenRequests).toBe(2);
  });

  it("removes its temp directory when it succeeds", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    expect(await readdir(tempRoot)).toEqual([]);
  });
});

describe("uploaded files", () => {
  it("fetches each file into the ZIP and rewrites its reference to the ZIP path", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);

    const invoices = JSON.parse(text(entries["lax-data-2026-11-02/bid/invoices.json"]));
    const pdf = invoices.records[0].pdf;
    expect(pdf).toMatchObject({
      included: true,
      path: "bid/files/invoices/i1-Invoice_1.pdf",
      fileName: "Invoice 1.pdf",
      contentType: "application/pdf",
      byteSize: 12,
    });
    expect(JSON.stringify(invoices)).not.toContain("files.test");
    expect(text(entries[`lax-data-2026-11-02/${pdf.path}`])).toBe("PDF-BYTES-01");
    expect(pdf.sha256).toBe(createHash("sha256").update("PDF-BYTES-01").digest("hex"));
    // Other fields of the record are untouched.
    expect(invoices.records[0].total).toEqual({ minor: 260000, currency: "GBP" });
  });

  it("lists a file the product no longer has as unavailable, with 'ask us'", async () => {
    const world = createWorld(tempRoot);
    world.host.files.clear();
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);
    const pdf = JSON.parse(text(entries["lax-data-2026-11-02/bid/invoices.json"])).records[0].pdf;
    expect(pdf).toMatchObject({
      included: false,
      reason: "unavailable",
      fileName: "Invoice 1.pdf",
    });
    expect(pdf.message).toMatch(/ask us/i);
  });

  it("retries later when a file link fails, rather than shipping without it", async () => {
    const world = createWorld(tempRoot);
    world.host.failWith = 503;
    const attempt = world.assembler.run(request, firstAttempt());
    await expect(attempt).rejects.toMatchObject({ kind: "transient", code: "file_http_503" });
    expect(world.store.objects.size).toBe(0);
  });
});

describe("the size cap", () => {
  const bigName = "Big.pdf";
  function capped(declared: number | null) {
    const world = createWorld(tempRoot, { budget: () => new ArchiveBudget(200_000, 1_000) });
    world.bid.set("invoices", [
      record("i1", { pdf: fileRef("Invoice 1.pdf", 11) }),
      record("i2", { pdf: fileRef(bigName, declared) }),
    ]);
    world.host.put(bigName, new Uint8Array(250_000).fill(7));
    return world;
  }

  it("leaves out a file that would pass the cap, says so in the JSON and ships the rest", async () => {
    const world = capped(null);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);
    const [small, big] = JSON.parse(text(entries["lax-data-2026-11-02/bid/invoices.json"])).records;
    expect(small.pdf.included).toBe(true);
    expect(big.pdf).toMatchObject({ included: false, reason: "size_cap", fileName: bigName });
    expect(big.pdf.message).toMatch(/ask us/i);
    expect(Object.keys(entries).some((path) => path.includes("Big"))).toBe(false);
    expect(text(entries["lax-data-2026-11-02/Your LAX data.html"])).toContain(
      "1 uploaded file is not in this ZIP",
    );
  });

  it("skips a file whose declared size cannot fit without fetching it", async () => {
    const world = capped(250_000);
    await world.assembler.run(request, firstAttempt());
    expect(world.host.requested).not.toContain(`/${encodeURIComponent(bigName)}`);
    const { entries } = await readyZip(world);
    const big = JSON.parse(text(entries["lax-data-2026-11-02/bid/invoices.json"])).records[1];
    expect(big.pdf).toMatchObject({ included: false, reason: "size_cap", byteSize: 250_000 });
  });

  it("fails for good when the data alone is over the cap, because it cannot be met", async () => {
    const world = createWorld(tempRoot, { budget: () => new ArchiveBudget(500, 0) });
    await expect(world.assembler.run(request, firstAttempt())).rejects.toBeInstanceOf(
      SubjectExportTerminalError,
    );
    expect(world.progress.reports.at(-1)).toEqual({
      event: "failed",
      errorCode: "export_too_large",
    });
    expect(world.store.objects.size).toBe(0);
  });
});

describe("a product that does not answer", () => {
  it("is retried while the window is open, reporting nothing and uploading nothing", async () => {
    const world = createWorld(tempRoot);
    world.bid.failWith = 503;
    const attempt = world.assembler.run(request, firstAttempt(new Date(NOW.getTime() - 5 * HOUR)));
    await expect(attempt).rejects.toBeInstanceOf(SubjectExportError);
    await expect(
      world.assembler.run(request, firstAttempt(new Date(NOW.getTime() - 5 * HOUR))),
    ).rejects.toMatchObject({ kind: "transient", code: "product_http_503", product: "bid" });
    expect(world.progress.reports.map((r) => r.event)).toEqual([
      "product_collected",
      "product_collected",
    ]);
    expect(world.store.objects.size).toBe(0);
  });

  it("is reported delayed after 72 hours, never shipping a partial copy", async () => {
    const world = createWorld(tempRoot);
    world.bid.failWith = 503;
    const attempt = world.assembler.run(request, firstAttempt(new Date(NOW.getTime() - 73 * HOUR)));
    await expect(attempt).rejects.toMatchObject({ outcome: "delayed", code: "product_http_503" });
    expect(world.progress.reports.at(-1)).toEqual({
      event: "delayed",
      product: "bid",
      errorCode: "product_http_503",
    });
    expect(world.store.objects.size).toBe(0);
    expect(world.progress.reports.some((r) => r.event === "ready")).toBe(false);
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it("is reported delayed on the last attempt even inside 72 hours", async () => {
    const world = createWorld(tempRoot);
    world.shop.failWith = 500;
    await expect(
      world.assembler.run(request, { number: 13, maxAttempts: 13, queuedAt: NOW }),
    ).rejects.toMatchObject({ outcome: "delayed" });
    expect(world.progress.reports.at(-1)).toMatchObject({ event: "delayed", product: "shop" });
  });

  it("treats an attempt that runs past its time limit as a transient failure", async () => {
    const world = createWorld(tempRoot);
    world.bid.hang = true;
    const assembler = new SubjectExportAssembler({
      sources: {
        account: world.account.source(),
        bid: world.bid.source(),
        shop: world.shop.source(),
      },
      progress: world.progress,
      store: world.store,
      log: { info: noop, warn: noop },
      tempRoot,
      now: () => NOW,
      attemptTimeoutMs: 50,
    });
    await expect(assembler.run(request, firstAttempt())).rejects.toMatchObject({
      kind: "transient",
      code: "attempt_timeout",
    });
    expect(world.store.objects.size).toBe(0);
  });

  it("retries when the bucket will not take the upload, and reports failed when attempts are spent", async () => {
    const world = createWorld(tempRoot);
    world.store.failUpload = new Error("bucket down");
    await expect(world.assembler.run(request, firstAttempt())).rejects.toMatchObject({
      kind: "transient",
      code: "storage_upload_failed",
    });
    await expect(
      world.assembler.run(request, { number: 13, maxAttempts: 13, queuedAt: NOW }),
    ).rejects.toMatchObject({ outcome: "failed" });
    expect(world.progress.reports.at(-1)).toEqual({
      event: "failed",
      errorCode: "storage_upload_failed",
    });
  });
});

describe("a failure that cannot be fixed by waiting", () => {
  it("reports failed straight away and stops", async () => {
    const world = createWorld(tempRoot);
    world.bid.failWith = 422;
    await expect(world.assembler.run(request, firstAttempt())).rejects.toMatchObject({
      outcome: "failed",
      code: "product_http_422",
    });
    expect(world.progress.reports.at(-1)).toEqual({
      event: "failed",
      errorCode: "product_http_422",
    });
    expect(await readdir(tempRoot)).toEqual([]);
  });

  it("fails when a product's paging never ends", async () => {
    const world = createWorld(tempRoot);
    world.bid.cursorLoop = true;
    await expect(world.assembler.run(request, firstAttempt())).rejects.toMatchObject({
      outcome: "failed",
      code: "product_cursor_loop",
    });
  });

  it("fails when a product answers outside the contract", async () => {
    const world = createWorld(tempRoot);
    world.shop.set("orders", [{ id: "", origin: "invented" } as never]);
    await expect(world.assembler.run(request, firstAttempt())).rejects.toMatchObject({
      outcome: "failed",
      code: "invalid_product_response",
    });
  });

  it("waits for a worker deploy when a product lists a category the worker does not know", async () => {
    const world = createWorld(tempRoot);
    world.bid.set("brand-new-category", [record("x1")]);
    await expect(world.assembler.run(request, firstAttempt())).rejects.toMatchObject({
      kind: "transient",
      code: "product_ahead_of_worker",
    });
  });
});

describe("what is written into the ZIP besides data", () => {
  it("lists every file in the manifest with the checksum of its bytes", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);
    const manifest = JSON.parse(text(entries["lax-data-2026-11-02/manifest.json"]));
    expect(manifest).toMatchObject({
      exportId: EXPORT_ID,
      createdAt: NOW.toISOString(),
      omittedFiles: 0,
    });
    const listed = new Map<string, { bytes: number; sha256: string }>(
      manifest.files.map((f: { path: string; bytes: number; sha256: string }) => [f.path, f]),
    );
    const names = Object.keys(entries).filter((n) => !n.endsWith("manifest.json"));
    expect(listed.size).toBe(names.length);
    for (const name of names) {
      const bytes = entries[name] as Uint8Array;
      const entry = listed.get(name.replace("lax-data-2026-11-02/", ""));
      expect(entry, name).toBeDefined();
      expect(entry?.bytes).toBe(bytes.length);
      expect(entry?.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
    }
  });

  it("greets the person from their own account files, escaped", async () => {
    const world = createWorld(tempRoot);
    await world.assembler.run(request, firstAttempt());
    const { entries } = await readyZip(world);
    const html = text(entries["lax-data-2026-11-02/Your LAX data.html"]);
    expect(html).toContain("Sarah &lt;Whitfield&gt; (sarah@example.test)");
    expect(html).not.toContain("<Whitfield>");
  });
});
