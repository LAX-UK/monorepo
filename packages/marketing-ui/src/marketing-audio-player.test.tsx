import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketingAudioPlayer, formatAudioTime } from "./marketing-audio-player.js";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

let paused = true;

beforeEach(() => {
  paused = true;
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(() => paused);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async function (
    this: HTMLMediaElement,
  ) {
    paused = false;
    this.dispatchEvent(new Event("play"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    paused = true;
    this.dispatchEvent(new Event("pause"));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatAudioTime", () => {
  it("formats minutes and hours, clamping bad input", () => {
    expect(formatAudioTime(187)).toBe("3:07");
    expect(formatAudioTime(3723)).toBe("1:02:03");
    expect(formatAudioTime(-4)).toBe("0:00");
    expect(formatAudioTime(Number.NaN)).toBe("0:00");
  });
});

describe("MarketingAudioPlayer", () => {
  it("toggles between play and pause and names the control after the episode", async () => {
    render(<MarketingAudioPlayer src="https://media.example/a.mp3" title="Studio light" />);
    fireEvent.click(screen.getByRole("button", { name: "Play Studio light" }));
    expect(await screen.findByRole("button", { name: "Pause Studio light" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pause Studio light" }));
    expect(await screen.findByRole("button", { name: "Play Studio light" })).toBeInTheDocument();
  });

  it("shows the supplied duration before the file loads and the real one afterwards", () => {
    const { container } = render(
      <MarketingAudioPlayer src="https://media.example/a.mp3" title="Ep" durationSeconds={2778} />,
    );
    expect(screen.getByText("46:18")).toBeInTheDocument();
    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { value: 60, configurable: true });
    fireEvent.loadedMetadata(audio);
    expect(screen.getByText("1:00")).toBeInTheDocument();
  });

  it("exposes a named seek slider that follows playback", () => {
    const { container } = render(
      <MarketingAudioPlayer src="https://media.example/a.mp3" title="Ep" durationSeconds={100} />,
    );
    const audio = container.querySelector("audio") as HTMLAudioElement;
    Object.defineProperty(audio, "currentTime", { value: 30, writable: true });
    fireEvent.timeUpdate(audio);
    const slider = screen.getByRole("slider", { name: "Seek Ep" });
    expect(slider).toHaveAttribute("aria-valuenow", "30");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
  });

  it("disables playback and says so when the file fails to load", () => {
    const { container } = render(
      <MarketingAudioPlayer src="https://media.example/a.mp3" title="Ep" />,
    );
    fireEvent.error(container.querySelector("audio") as HTMLAudioElement);
    expect(screen.getByRole("button", { name: "Play Ep" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });
});
