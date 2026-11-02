import { textOf as rawTextOf } from "@/test/text-of";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DataExportPanel } from "./data-export-panel";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/data-export-actions.server", () => ({
  requestDataExportAction: vi.fn(),
  deleteDataExportCopyAction: vi.fn(),
}));

const textOf = (html: string) => rawTextOf(html).replaceAll("&#x27;", "'");

const FULL = "https://test.lax.bid/contact?intent=data-copy";
const PRODUCTS = [
  { product: "account", name: "LAX Account", state: "done", label: "Done" },
  { product: "bid", name: "LAX Bid", state: "retrying", label: "Trying again" },
  { product: "shop", name: "LAX Shop and lax.art", state: "waiting", label: "Waiting" },
] as const;

const render = (
  vm: Parameters<typeof DataExportPanel>[0]["vm"],
  problem: Parameters<typeof DataExportPanel>[0]["problem"] = null,
) =>
  renderToStaticMarkup(
    <DataExportPanel
      vm={vm}
      fullCopyHref={FULL}
      contactHref="https://test.lax.bid/contact"
      retryHref="/account/privacy/download"
      resume={null}
      problem={problem}
    />,
  );

describe("DataExportPanel", () => {
  it("A offers one request and the always-present full-copy link", () => {
    const html = render({ kind: "ready_to_request" });
    const text = textOf(html);
    expect(text).toContain("LAX Account");
    expect(text).toContain("Request your data");
    expect(html).toContain(`href="${FULL}"`);
    expect(text).toContain("Request a full copy");
  });

  it("C shows progress, disables a second request and says why", () => {
    const html = render({
      kind: "preparing",
      requestedAt: "today at 14:02",
      email: "ada@example.com",
      products: [...PRODUCTS],
    });
    const text = textOf(html);
    expect(text).toContain(
      "Requested today at 14:02. We'll email ada@example.com when it's ready.",
    );
    expect(text).toContain("One request at a time.");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain(`href="${FULL}"`);
  });

  it("D shows file, size and expiry, with download and delete", () => {
    const html = render({
      kind: "ready",
      exportId: "exp_1",
      fileName: "lax-data.zip",
      size: "38 MB",
      largeFile: true,
      preparedAt: "2 Nov 2026 at 14:03",
      availableUntil: "9 Nov 2026",
      downloads: "downloaded once",
    });
    const text = textOf(html);
    expect(text).toContain("lax-data.zip · 38 MB");
    expect(text).toContain("available until 9 Nov 2026 · downloaded once");
    expect(text).toContain("Large file. On mobile data it may take a while.");
    expect(text).toContain("Download");
    expect(text).toContain("Delete this copy");
  });

  it("D explains a download that did not start without losing the copy", () => {
    const html = render(
      {
        kind: "ready",
        exportId: "exp_1",
        fileName: "lax-data.zip",
        size: "2 MB",
        largeFile: false,
        preparedAt: "x",
        availableUntil: "y",
        downloads: "not downloaded yet",
      },
      "download_unavailable",
    );
    expect(textOf(html)).toContain("We couldn't start your download");
    expect(textOf(html)).not.toContain("Large file");
  });

  it("E shows the legal due date and the contact link", () => {
    const text = textOf(
      render({ kind: "delayed", dueOn: "2 December 2026", email: null, products: [...PRODUCTS] }),
    );
    expect(text).toContain("Taking longer than usual");
    expect(text).toContain("no later than 2 December 2026");
    expect(text).toContain("Trying again");
    expect(text).toContain("Contact us");
  });

  it("F says the copy is gone and offers a new one", () => {
    const text = textOf(render({ kind: "expired", message: "Your last copy expired." }));
    expect(text).toContain("Expired");
    expect(text).toContain("Request a new copy");
  });

  it("offers a retry, and no request or download, when Identity cannot be asked", () => {
    const html = render({ kind: "unavailable" });
    expect(textOf(html)).toContain("nothing has changed");
    expect(textOf(html)).not.toContain("Request your data");
    expect(html).toContain('href="/account/privacy/download"');
  });

  it("never uses an em dash", () => {
    for (const vm of [
      { kind: "ready_to_request" },
      { kind: "expired", message: "x" },
      { kind: "unavailable" },
    ] as const) {
      expect(render(vm)).not.toContain("—");
    }
  });
});
