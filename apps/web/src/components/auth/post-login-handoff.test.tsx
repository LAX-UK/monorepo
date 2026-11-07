import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let effectsReady: () => void = () => {};
vi.mock("@/components/analytics/hosted-login-sync", () => ({
  HostedLoginSync: ({ onEffectsReady }: { onEffectsReady: () => void }) => {
    effectsReady = onEffectsReady;
    return null;
  },
}));

import { PostLoginHandoff } from "./post-login-handoff";

const replace = vi.fn();
const realLocation = window.location;

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(window, "location", { value: { replace }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "location", { value: realLocation, configurable: true });
  vi.clearAllMocks();
});

describe("PostLoginHandoff", () => {
  it("moves on with a page load, not a router navigation, when sign-in effects are done", () => {
    render(<PostLoginHandoff destination="/home" />);
    effectsReady();
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/home");
  });

  it("moves on after the effects wait, and only once", () => {
    render(<PostLoginHandoff destination="/home" />);
    vi.advanceTimersByTime(400);
    effectsReady();
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
