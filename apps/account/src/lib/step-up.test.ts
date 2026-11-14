import { describe, expect, it, vi } from "vitest";
import {
  STEP_UP_WINDOW_NAME,
  type StepUpEnvironment,
  type StepUpState,
  type StepUpWindow,
  createStepUpController,
  isStepUpComplete,
  stepUpWindowFeatures,
  withResume,
  withoutResume,
} from "./step-up";

const ORIGIN = "https://account.test";
const OK = { type: "lax-step-up", status: "ok" };

function harness(options: { blocked?: boolean } = {}) {
  const popup: StepUpWindow = { closed: false, close: vi.fn(), focus: vi.fn() };
  let listener: Parameters<StepUpEnvironment["onMessage"]>[0] = () => undefined;
  let tick: () => void = () => undefined;
  const env: StepUpEnvironment = {
    origin: ORIGIN,
    open: vi.fn(() => (options.blocked ? null : popup)),
    assign: vi.fn(),
    features: () => "popup=yes",
    onMessage: (next) => {
      listener = next;
      return () => undefined;
    },
    every: (_ms, next) => {
      tick = next;
      return () => {
        tick = () => undefined;
      };
    },
  };
  const states: StepUpState[] = [];
  const onConfirmed = vi.fn();
  const controller = createStepUpController({
    env,
    onChange: (state) => states.push(state),
    onConfirmed,
  });
  const last = () => states.at(-1);
  const send = (event: { origin?: string; source?: unknown; data?: unknown }) =>
    listener({ origin: ORIGIN, source: popup, data: OK, ...event });
  const request = {
    reason: "sign_out_devices" as const,
    returnTo: "/account/security",
    resume: "signout:s2",
  };
  return { controller, env, popup, last, send, onConfirmed, tick: () => tick(), request };
}

describe("the Confirm it's you step", () => {
  it("asks, opens a small named window from the click, and runs the action again once confirmed", () => {
    const h = harness();
    h.controller.require();
    expect(h.last()).toEqual({ phase: "confirm", notConfirmed: false });

    h.controller.continue(h.request);
    const [url, name] = vi.mocked(h.env.open).mock.calls[0] ?? [];
    const opened = new URL(url ?? "", ORIGIN);
    expect(opened.pathname).toBe("/api/auth/login");
    expect(opened.searchParams.get("intent")).toBe("reauth");
    expect(opened.searchParams.get("display")).toBe("popup");
    expect(opened.searchParams.get("reason")).toBe("sign_out_devices");
    expect(name).toBe(STEP_UP_WINDOW_NAME);
    expect(h.last()?.phase).toBe("waiting");

    h.send({});
    expect(h.onConfirmed).toHaveBeenCalledTimes(1);
    expect(h.last()).toEqual({ phase: "idle", notConfirmed: false });
    expect(h.env.assign).not.toHaveBeenCalled();
  });

  it("ignores a message from another origin", () => {
    const h = harness();
    h.controller.require();
    h.controller.continue(h.request);
    h.send({ origin: "https://evil.example" });
    expect(h.onConfirmed).not.toHaveBeenCalled();
    expect(h.last()?.phase).toBe("waiting");
  });

  it("ignores a message from any window but the one it opened", () => {
    const h = harness();
    h.controller.require();
    h.controller.continue(h.request);
    h.send({ source: {} });
    h.send({ source: null });
    expect(h.onConfirmed).not.toHaveBeenCalled();
  });

  it("ignores a message of any other shape, and one that arrives before Continue", () => {
    const h = harness();
    h.send({});
    h.controller.require();
    h.controller.continue(h.request);
    h.send({ data: { type: "lax-step-up", status: "failed" } });
    h.send({ data: "ok" });
    expect(h.onConfirmed).not.toHaveBeenCalled();
  });

  it("stays on Confirm it's you, saying not confirmed yet, when the window is closed", () => {
    const h = harness();
    h.controller.require();
    h.controller.continue(h.request);
    h.tick();
    expect(h.last()?.phase).toBe("waiting");
    h.popup.closed = true;
    h.tick();
    expect(h.last()).toEqual({ phase: "confirm", notConfirmed: true });
    expect(h.onConfirmed).not.toHaveBeenCalled();
  });

  it("says not confirmed yet when the action still asks after a confirmation", () => {
    const h = harness();
    h.controller.require();
    h.controller.continue(h.request);
    h.send({});
    h.controller.require();
    expect(h.last()).toEqual({ phase: "confirm", notConfirmed: true });
  });

  it("falls back to a full-page sign-in naming the pending action when the window is blocked", () => {
    const h = harness({ blocked: true });
    h.controller.require();
    h.controller.continue(h.request);
    const target = new URL(vi.mocked(h.env.assign).mock.calls[0]?.[0] ?? "", ORIGIN);
    expect(target.pathname).toBe("/api/auth/login");
    expect(target.searchParams.has("display")).toBe(false);
    expect(target.searchParams.get("reason")).toBe("sign_out_devices");
    expect(target.searchParams.get("returnTo")).toBe("/account/security?resume=signout%3As2");
  });

  it("cancels without changing anything, and closes the window it opened", () => {
    const h = harness();
    h.controller.require();
    h.controller.continue(h.request);
    h.controller.cancel();
    expect(h.popup.close).toHaveBeenCalled();
    expect(h.last()).toEqual({ phase: "idle", notConfirmed: false });
    h.send({});
    expect(h.onConfirmed).not.toHaveBeenCalled();
  });
});

describe("isStepUpComplete", () => {
  const source = {};
  it("accepts only the exact origin, the opened window and the ok status", () => {
    expect(isStepUpComplete({ origin: ORIGIN, source, data: OK }, { origin: ORIGIN, source })).toBe(
      true,
    );
    expect(
      isStepUpComplete({ origin: `${ORIGIN}:8443`, source, data: OK }, { origin: ORIGIN, source }),
    ).toBe(false);
    expect(
      isStepUpComplete(
        { origin: ORIGIN, source: null, data: OK },
        { origin: ORIGIN, source: null },
      ),
    ).toBe(false);
  });
});

describe("resume in the return path", () => {
  it("adds and removes only its own parameter", () => {
    expect(withResume("/account/security?tab=1#devices", "signout-others")).toBe(
      "/account/security?tab=1&resume=signout-others#devices",
    );
    expect(withoutResume("/account/security?tab=1&resume=signout-others#devices")).toBe(
      "/account/security?tab=1#devices",
    );
    expect(withoutResume("/account/security?resume=signout%3As2")).toBe("/account/security");
  });
});

describe("stepUpWindowFeatures", () => {
  it("centres a 480 by 640 window on the current one", () => {
    expect(
      stepUpWindowFeatures({ screenX: 100, screenY: 50, outerWidth: 1280, outerHeight: 800 }),
    ).toBe("popup=yes,width=480,height=640,left=500,top=130");
  });
});
