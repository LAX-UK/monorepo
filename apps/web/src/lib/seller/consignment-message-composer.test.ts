import { describe, expect, it } from "vitest";
import { composerSendState, pickAttachableFiles } from "./consignment-message-composer";

const file = (name: string, type: string, size = 1000) => ({ name, type, size }) as unknown as File;

describe("composerSendState", () => {
  it("sends words, or a checked file alone", () => {
    expect(composerSendState({ body: "Hello", files: [] }).canSend).toBe(true);
    expect(
      composerSendState({
        body: "",
        files: [{ id: "1", name: "a.jpg", status: "ready", uploadObjectId: "u1" }],
      }).canSend,
    ).toBe(true);
  });

  it("says why Send is off", () => {
    expect(composerSendState({ body: "  ", files: [] }).sendBlockedReason).toBe(
      "Write a message or attach a file",
    );
    const checking = composerSendState({
      body: "Hi",
      files: [{ id: "1", name: "a.jpg", status: "uploading", uploadObjectId: null }],
    });
    expect(checking.sendBlockedReason).toBe("Wait until the files are checked");
    expect(checking.hint).toBe("Checking the files before they can be sent…");
    expect(
      composerSendState({
        body: "Hi",
        files: [{ id: "1", name: "a.jpg", status: "failed", uploadObjectId: null }],
      }).sendBlockedReason,
    ).toBe("Remove the file that could not be attached");
  });

  it("stops attaching at five files", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `${i}.jpg`,
      status: "ready" as const,
      uploadObjectId: `u${i}`,
    }));
    expect(composerSendState({ body: "", files: five })).toMatchObject({
      canAttach: false,
      attachBlockedReason: "Up to 5 files on one message",
    });
  });
});

describe("pickAttachableFiles", () => {
  it("keeps photos and PDFs within the size and count, and says what was left out", () => {
    const picked = [
      file("a.jpg", "image/jpeg"),
      file("b.pdf", "application/pdf"),
      file("c.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      file("d.png", "image/png", 20 * 1024 * 1024),
    ];
    const { accepted, problem } = pickAttachableFiles(picked, 0);
    expect(accepted.map((f) => f.name)).toEqual(["a.jpg", "b.pdf"]);
    expect(problem).toBe("Only photos (JPEG, PNG, WebP) or PDFs up to 15 MB can be attached.");
    expect(pickAttachableFiles([file("e.jpg", "image/jpeg")], 5)).toEqual({
      accepted: [],
      problem: "Up to 5 files on one message.",
    });
  });
});
