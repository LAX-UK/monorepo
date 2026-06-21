import { describe, expect, it } from "vitest";

const EVENT_ORIGIN = process.env.EVENT_SMOKE_ORIGIN ?? "http://localhost:3003";

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

describe("local event dev smoke", () => {
  it("serves the invitation page", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    const res = await fetch(`${EVENT_ORIGIN}/`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('id="rsvp-panel"');
    expect(html).toContain('id="rsvp-support"');
    expect(html).toContain('href="/rsvp.css"');
    expect(html).not.toContain("RSVP isn't available just now");
  });

  it("proxies RSVP config from the local API", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    const res = await fetch(`${EVENT_ORIGIN}/events/lax001/config`, {
      headers: { Accept: "application/json" },
    });
    if (res.status >= 500) {
      console.warn(`skip: local API proxy not ready for config (${res.status})`);
      return;
    }
    const body = (await res.json()) as {
      data?: { slug: string; rsvpOpen: boolean; segmentOptions: unknown[] };
    };

    expect(res.status).toBe(200);
    expect(body.data?.slug).toBe("lax001");
    expect(typeof body.data?.rsvpOpen).toBe("boolean");
    expect(body.data?.segmentOptions?.length).toBeGreaterThan(0);
  });

  it("proxies RSVP email lookup with status aligned to config", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    const configRes = await fetch(`${EVENT_ORIGIN}/events/lax001/config`, {
      headers: { Accept: "application/json" },
    });
    if (configRes.status >= 500) {
      console.warn(`skip: local API proxy not ready for config (${configRes.status})`);
      return;
    }
    const configBody = (await configRes.json()) as {
      data?: { rsvpOpen: boolean };
    };
    const rsvpOpen = configBody.data?.rsvpOpen === true;

    const res = await fetch(`${EVENT_ORIGIN}/events/lax001/lookup`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "smoke-test@example.com" }),
    });
    if (res.status >= 500) {
      console.warn(`skip: local API proxy not ready for lookup (${res.status})`);
      return;
    }
    const body = (await res.json()) as { data?: { status: string } };

    expect(res.status).toBe(200);
    expect(body.data?.status).toBe(rsvpOpen ? "not_registered" : "event_closed");
  });

  it("serves bundled invitation images from public/", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    for (const asset of ["hero.jpg", "highlight-lot.jpg"] as const) {
      const res = await fetch(`${EVENT_ORIGIN}/events/lax001/${asset}`);
      expect(res.status, asset).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/^image\//);
    }
  });

  it("serves pass page shell", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    const res = await fetch(`${EVENT_ORIGIN}/pass/smoke-test-token`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain('id="pass-root"');
  });

  it("proxies onsite catalogue sales list", async () => {
    if (!(await reachable(`${EVENT_ORIGIN}/`))) {
      console.warn(`skip: event dev server not running at ${EVENT_ORIGIN}`);
      return;
    }

    const res = await fetch(
      `${EVENT_ORIGIN}/sales?deliveryMode=onsite&statuses=scheduled,active&limit=1&offset=0`,
      { headers: { Accept: "application/json" } },
    );

    expect(res.status).toBe(200);
  });
});
