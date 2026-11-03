import { describe, expect, it } from "vitest";
import {
  type UploadItem,
  addPicked,
  describeRejection,
  doneUploadIds,
  markDone,
  markProgress,
  markRejected,
  pickFiles,
  removeItem,
  submitButtonState,
} from "./enquiry-uploads";

const file = (name: string, type: string, size = 1000) => ({ name, type, size }) as File;
const jpeg = (name = "front.jpg", size = 2_100_000) => file(name, "image/jpeg", size);
const pdf = (name = "invoice.pdf", size = 3_000_000) => file(name, "application/pdf", size);

const item = (over: Partial<UploadItem>): UploadItem => ({
  id: "i",
  name: "front.jpg",
  size: 100,
  kind: "image",
  state: "uploading",
  progress: 0,
  ...over,
});

describe("pickFiles", () => {
  it("takes JPEG, PNG and WebP photos and PDFs", () => {
    const picked = pickFiles(
      [jpeg(), file("a.png", "image/png"), file("a.webp", "image/webp"), pdf()],
      [],
    );
    expect(picked.map((p) => [p.file.name, p.kind, p.refusal])).toEqual([
      ["front.jpg", "image", null],
      ["a.png", "image", null],
      ["a.webp", "image", null],
      ["invoice.pdf", "document", null],
    ]);
  });

  it("refuses other types with the reason shown in the queue", () => {
    const [heic, zip] = pickFiles(
      [file("scan.heic", "image/heic"), file("a.zip", "application/zip")],
      [],
    );
    expect(heic?.refusal).toBe("use JPEG, PNG or WebP");
    expect(zip?.refusal).toBe("use JPEG, PNG or WebP, or a PDF");
  });

  it("refuses a photo over 10 MB and a PDF over 25 MB", () => {
    const [photo, doc, fine] = pickFiles(
      [
        jpeg("big.jpg", 10 * 1024 * 1024 + 1),
        pdf("big.pdf", 25 * 1024 * 1024 + 1),
        pdf("ok.pdf", 25 * 1024 * 1024),
      ],
      [],
    );
    expect(photo?.refusal).toBe("larger than 10 MB");
    expect(doc?.refusal).toBe("larger than 25 MB");
    expect(fine?.refusal).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(pickFiles([jpeg("empty.jpg", 0)], [])[0]?.refusal).toBe("the file is empty");
  });

  it("allows six photos and two PDFs, counting only files that were not refused", () => {
    const existing = Array.from({ length: 5 }, (_, i) =>
      item({ id: `p${i}`, state: i === 0 ? "rejected" : "done" }),
    );
    // Four good photos already: two more fit, the third does not.
    const picked = pickFiles([jpeg("a.jpg"), jpeg("b.jpg"), jpeg("c.jpg")], existing);
    expect(picked.map((p) => p.refusal)).toEqual(
      [null, null, null].map((_, i) => (i < 2 ? null : "up to 6 photos")),
    );
  });

  it("limits PDFs to two", () => {
    const picked = pickFiles([pdf("1.pdf"), pdf("2.pdf"), pdf("3.pdf")], []);
    expect(picked.map((p) => p.refusal)).toEqual([null, null, "up to 2 PDFs"]);
  });

  it("never lets more than eight files wait on one enquiry", () => {
    const picked = pickFiles(
      [jpeg(), jpeg(), jpeg(), jpeg(), jpeg(), jpeg(), pdf(), pdf(), jpeg("seventh.jpg")],
      [],
    );
    expect(picked.filter((p) => p.refusal === null)).toHaveLength(8);
    expect(picked[8]?.refusal).toBe("up to 6 photos");
  });
});

describe("the queue", () => {
  it("adds picked files as uploading and refused files as rejected, in the order picked", () => {
    const items = addPicked(
      [],
      pickFiles([jpeg(), file("scan.heic", "image/heic")], []),
      () => "id",
    );
    expect(items.map((i) => [i.name, i.state, i.reason])).toEqual([
      ["front.jpg", "uploading", undefined],
      ["scan.heic", "rejected", "use JPEG, PNG or WebP"],
    ]);
  });

  it("moves a file through progress to done, keeping the id the server gave it", () => {
    let items = [item({ id: "a" }), item({ id: "b" })];
    items = markProgress(items, "a", 0.6);
    expect(items[0]).toMatchObject({ state: "uploading", progress: 0.6 });
    items = markDone(items, "a", "upload-1");
    expect(items[0]).toMatchObject({ state: "done", progress: 1, uploadId: "upload-1" });
    expect(items[1]?.state).toBe("uploading");
  });

  it("keeps a rejected file in the queue with its reason", () => {
    const items = markRejected([item({ id: "a" })], "a", "content_type_mismatch");
    expect(items[0]).toMatchObject({
      state: "rejected",
      reason: describeRejection("content_type_mismatch"),
    });
  });

  it("removes a file by id", () => {
    expect(removeItem([item({ id: "a" }), item({ id: "b" })], "a").map((i) => i.id)).toEqual(["b"]);
  });

  it("sends only the files that passed their checks, in the order shown", () => {
    const items = [
      item({ id: "1", state: "done", uploadId: "u1" }),
      item({ id: "2", state: "rejected" }),
      item({ id: "3", state: "uploading" }),
      item({ id: "4", state: "done", uploadId: "u4" }),
    ];
    expect(doneUploadIds(items)).toEqual(["u1", "u4"]);
  });
});

describe("describeRejection", () => {
  it("puts the worker's reasons in plain words", () => {
    expect(describeRejection("content_type_mismatch")).toBe("that isn't a valid photo or PDF");
    expect(describeRejection("malware")).toBe("we couldn't accept that file");
    expect(describeRejection("oversize")).toBe("larger than the limit");
    expect(describeRejection("missing")).toBe("the upload didn't finish");
    expect(describeRejection("something new")).toBe("we couldn't accept that file");
  });

  it("keeps a sentence the API already wrote", () => {
    expect(describeRejection("Use a JPEG, PNG or WebP photo.")).toBe(
      "Use a JPEG, PNG or WebP photo.",
    );
  });
});

describe("submitButtonState", () => {
  it("says Send enquiry when nothing is pending", () => {
    expect(
      submitButtonState([item({ state: "done" }), item({ state: "rejected" })], false),
    ).toEqual({
      label: "Send enquiry",
      busy: false,
      waiting: false,
    });
  });

  it("says Sending… while the enquiry goes", () => {
    expect(submitButtonState([], true)).toEqual({ label: "Sending…", busy: true, waiting: false });
  });

  it("says how many photos it is waiting for", () => {
    expect(submitButtonState([item({}), item({ id: "2" })], false)).toEqual({
      label: "Waiting for 2 photos…",
      busy: true,
      waiting: true,
    });
    expect(submitButtonState([item({})], false).label).toBe("Waiting for 1 photo…");
  });

  it("names documents and mixed files", () => {
    expect(submitButtonState([item({ kind: "document" })], false).label).toBe(
      "Waiting for 1 document…",
    );
    expect(submitButtonState([item({}), item({ id: "2", kind: "document" })], false).label).toBe(
      "Waiting for 2 files…",
    );
  });
});
