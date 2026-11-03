import { describe, expect, it, vi } from "vitest";
import { type SearchAlertPorts, ensureSearchAlert } from "./search-alert";

const row = (query: Record<string, string>) => ({
  id: "s1",
  label: "x",
  query,
  notifyEmail: true,
  createdAt: "2026-11-01T00:00:00Z",
});

function ports(over: Partial<SearchAlertPorts> = {}): SearchAlertPorts {
  return {
    list: vi.fn().mockResolvedValue({ ok: true, rows: [] }),
    create: vi.fn().mockResolvedValue({ ok: true }),
    ...over,
  };
}

describe("ensureSearchAlert", () => {
  it("creates an alert with email on for the search text", async () => {
    const p = ports();
    expect(await ensureSearchAlert("harbour", undefined, p)).toBe("created");
    expect(p.create).toHaveBeenCalledWith({
      label: "Search: harbour",
      query: { q: "harbour" },
      notifyEmail: true,
    });
  });

  it("writes nothing when the same search is already saved", async () => {
    const p = ports({
      list: vi.fn().mockResolvedValue({ ok: true, rows: [row({ q: "harbour" })] }),
    });
    expect(await ensureSearchAlert("harbour", undefined, p)).toBe("existing");
    expect(p.create).not.toHaveBeenCalled();
  });

  it("treats a different category as a different search", async () => {
    const p = ports({
      list: vi.fn().mockResolvedValue({ ok: true, rows: [row({ q: "harbour" })] }),
    });
    expect(await ensureSearchAlert("harbour", "c1", p)).toBe("created");
  });

  it("reports a failed save", async () => {
    const p = ports({ create: vi.fn().mockResolvedValue({ ok: false }) });
    expect(await ensureSearchAlert("harbour", undefined, p)).toBe("failed");
  });

  it("still saves when the saved list cannot be read", async () => {
    const p = ports({ list: vi.fn().mockResolvedValue({ ok: false }) });
    expect(await ensureSearchAlert("harbour", undefined, p)).toBe("created");
  });
});
