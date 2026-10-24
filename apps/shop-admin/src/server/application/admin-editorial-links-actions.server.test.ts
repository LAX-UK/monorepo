import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAdminJson = vi.fn();

vi.mock("./load-admin-data", () => ({ fetchAdminJson }));
vi.mock("./forward-admin-mutation", () => ({ forwardAdminJsonMutation: vi.fn() }));

const { resolveRailSlugs } = await import("./admin-editorial-links-actions.server");

const item = (slug: string, title: string) => ({
  id: `id-${slug}`,
  title,
  slug,
  thumbnailUrl: null,
  published: true,
});

beforeEach(() => {
  fetchAdminJson.mockReset();
});

describe("resolveRailSlugs", () => {
  it("searches each slug on its own and keeps only the exact address match", async () => {
    fetchAdminJson.mockImplementation(async (path: string) => {
      const q = new URLSearchParams(path.split("?")[1]).get("q");
      return {
        status: "ok",
        data: {
          items: [item(`${q}-extra`, "Close but not it"), item(q ?? "", `Title of ${q}`)],
          nextCursor: null,
        },
      };
    });

    const result = await resolveRailSlugs({ kind: "artwork", slugs: ["paper-rooms", "tides"] });

    expect(fetchAdminJson).toHaveBeenCalledTimes(2);
    expect(fetchAdminJson).toHaveBeenCalledWith(
      "editorial/link-candidates?kind=artwork&limit=5&q=paper-rooms",
    );
    expect(result).toEqual({
      ok: true,
      data: [item("paper-rooms", "Title of paper-rooms"), item("tides", "Title of tides")],
    });
  });

  it("asks once for a slug that appears twice", async () => {
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [], nextCursor: null } });
    await resolveRailSlugs({ kind: "artist", slugs: ["ada-lee", "ada-lee"] });
    expect(fetchAdminJson).toHaveBeenCalledTimes(1);
  });

  it("does not search an address that cannot be a slug; it comes back absent", async () => {
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [], nextCursor: null } });
    const result = await resolveRailSlugs({ kind: "artwork", slugs: ["Not A Slug", "../etc"] });
    expect(fetchAdminJson).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("looks up at most 24 addresses, the most a rail can show", async () => {
    fetchAdminJson.mockResolvedValue({ status: "ok", data: { items: [], nextCursor: null } });
    const slugs = Array.from({ length: 40 }, (_, index) => `work-${index}`);
    await resolveRailSlugs({ kind: "artwork", slugs });
    expect(fetchAdminJson).toHaveBeenCalledTimes(24);
  });

  it("refuses kinds that are not rails", async () => {
    const result = await resolveRailSlugs({ kind: "story" as never, slugs: ["x"] });
    expect(result).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchAdminJson).not.toHaveBeenCalled();
  });

  it("reports a failed read rather than naming nothing", async () => {
    fetchAdminJson.mockResolvedValue({ status: "forbidden" });
    expect(await resolveRailSlugs({ kind: "artwork", slugs: ["tides"] })).toEqual({
      ok: false,
      kind: "forbidden",
    });
  });
});
