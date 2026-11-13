import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrent = vi.fn();
const fetchFile = vi.fn();

vi.mock("@/lib/data/container.server", () => ({
  getServerDataContainer: async () => ({ session: { getCurrent } }),
}));
vi.mock("@/lib/collect/collect-api.server", () => ({
  fetchCalendarFile: (...args: unknown[]) => fetchFile(...args),
}));

import { GET } from "./route";

const BOOKING = "50000000-0000-4000-8000-000000000001";
const call = (bookingId = BOOKING) =>
  GET(new Request(`https://lax.test/purchases/collect/${bookingId}/calendar.ics`), {
    params: Promise.resolve({ bookingId }),
  });

describe("GET /purchases/collect/[bookingId]/calendar.ics", () => {
  beforeEach(() => {
    getCurrent.mockReset().mockResolvedValue({ id: "user-1" });
    fetchFile.mockReset();
  });

  it("passes the calendar file through", async () => {
    fetchFile.mockResolvedValue(new Response("BEGIN:VCALENDAR"));
    const res = await call();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
  });

  it("answers someone else's booking exactly like a missing one", async () => {
    fetchFile.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    const theirs = await call();
    fetchFile.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const missing = await call();
    expect(theirs.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await theirs.json()).toEqual(await missing.json());
  });

  it("refuses a malformed id before asking the API", async () => {
    expect((await call("not-a-uuid")).status).toBe(404);
    expect(fetchFile).not.toHaveBeenCalled();
  });
});
