import { describe, expect, it, vi } from "vitest";
import { type SearchEmailPorts, switchSearchEmail } from "./search-email";

const ports = (over: Partial<SearchEmailPorts> = {}): SearchEmailPorts => ({
  setSearch: vi.fn().mockResolvedValue(true),
  enableTopicEmail: vi.fn().mockResolvedValue({ ok: true }),
  ...over,
});

describe("switchSearchEmail", () => {
  it("turns the topic's email on before the search's", async () => {
    const p = ports();
    expect(await switchSearchEmail("s1", true, p)).toEqual({ ok: true });
    expect(p.enableTopicEmail).toHaveBeenCalled();
    expect(p.setSearch).toHaveBeenCalledWith("s1", true);
  });

  it("stops at the topic's error and leaves the search as it was", async () => {
    const p = ports({
      enableTopicEmail: vi.fn().mockResolvedValue({ ok: false, error: "Verify your email." }),
    });
    expect(await switchSearchEmail("s1", true, p)).toEqual({
      ok: false,
      error: "Verify your email.",
    });
    expect(p.setSearch).not.toHaveBeenCalled();
  });

  it("turns off only the search", async () => {
    const p = ports();
    expect(await switchSearchEmail("s1", false, p)).toEqual({ ok: true });
    expect(p.enableTopicEmail).not.toHaveBeenCalled();
    expect(p.setSearch).toHaveBeenCalledWith("s1", false);
  });

  it("switches only the topic on when there is no search id", async () => {
    const p = ports();
    expect(await switchSearchEmail(null, true, p)).toEqual({ ok: true });
    expect(p.enableTopicEmail).toHaveBeenCalled();
    expect(p.setSearch).not.toHaveBeenCalled();
  });

  it("reports a failed save", async () => {
    const p = ports({ setSearch: vi.fn().mockResolvedValue(false) });
    expect(await switchSearchEmail("s1", false, p)).toMatchObject({ ok: false });
  });
});
