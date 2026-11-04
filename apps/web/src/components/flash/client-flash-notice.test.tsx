import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const readClientFlashForPath = vi.hoisted(() => vi.fn());
vi.mock("@/lib/flash/client-flash.server", () => ({ readClientFlashForPath }));
vi.mock("@/components/flash/flash-clear", () => ({
  FlashClear: ({ path }: { path: string }) => <span data-clear={path} />,
}));

const { ClientFlashNotice } = await import("./client-flash-notice");

async function render(path = "/selling/new") {
  return renderToStaticMarkup(await ClientFlashNotice({ path }));
}

describe("ClientFlashNotice", () => {
  beforeEach(() => readClientFlashForPath.mockReset());

  it("renders nothing when no message is waiting", async () => {
    readClientFlashForPath.mockResolvedValue(null);
    expect(await render()).toBe("");
  });

  it("shows the message once in an alert and asks for it to be cleared", async () => {
    readClientFlashForPath.mockResolvedValue({ kind: "error", message: "Title is too long" });

    const html = await render("/selling/consignments/abc");

    expect(html).toContain("Title is too long");
    expect(html).toContain("We couldn&#x27;t save that");
    expect(html).toContain('data-clear="/selling/consignments/abc"');
    expect(readClientFlashForPath).toHaveBeenCalledWith("/selling/consignments/abc");
  });

  it("does not show a success message, as client actions report success by moving on", async () => {
    readClientFlashForPath.mockResolvedValue({ kind: "success", message: "Saved" });
    expect(await render()).toBe("");
  });
});
