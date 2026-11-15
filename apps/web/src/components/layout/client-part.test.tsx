import { act, render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CLIENT_PART_RETRY_MS, clientPart } from "./client-part";

const Part = ({ label }: { label: string }) => <p>{label}</p>;
type Load = () => Promise<ComponentType<{ label: string }>>;

/** Lets the pending load promises settle. */
const settle = () => act(async () => {});

describe("clientPart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws nothing until its code arrives, then the part with its props", async () => {
    let resolve: (part: ComponentType<{ label: string }>) => void = () => {};
    const load = vi.fn<Load>(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const Lazy = clientPart(load);
    const { container } = render(<Lazy label="Your accounts" />);
    expect(container).toBeEmptyDOMElement();

    resolve(Part);
    await settle();
    expect(screen.getByText("Your accounts")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("tries again after a failed fetch instead of breaking the page", async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValue(Part);
    const Lazy = clientPart(load);
    render(
      <>
        <Lazy label="Your accounts" />
        <p>Page</p>
      </>,
    );
    await settle();
    expect(screen.getByText("Page")).toBeInTheDocument();
    expect(screen.queryByText("Your accounts")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(CLIENT_PART_RETRY_MS[0]);
    });
    await act(async () => {
      vi.advanceTimersByTime(CLIENT_PART_RETRY_MS[1]);
    });
    expect(screen.getByText("Your accounts")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("stops trying after the last wait, still drawing nothing", async () => {
    const load = vi.fn<Load>().mockRejectedValue(new Error("ChunkLoadError"));
    const Lazy = clientPart(load);
    const { container } = render(<Lazy label="Your accounts" />);
    for (const delay of CLIENT_PART_RETRY_MS) {
      await settle();
      await act(async () => {
        vi.advanceTimersByTime(delay);
      });
    }
    await settle();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(load).toHaveBeenCalledTimes(CLIENT_PART_RETRY_MS.length + 1);
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches once for every place it is drawn", async () => {
    const load = vi.fn<Load>().mockResolvedValue(Part);
    const Lazy = clientPart(load);
    const first = render(<Lazy label="Bar" />);
    await settle();
    expect(screen.getByText("Bar")).toBeInTheDocument();
    render(<Lazy label="Strip" />);
    await settle();
    expect(screen.getByText("Strip")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(1);
    first.unmount();
  });

  it("stops waiting when it leaves the page", async () => {
    const load = vi.fn<Load>().mockRejectedValue(new Error("ChunkLoadError"));
    const Lazy = clientPart(load);
    const { unmount } = render(<Lazy label="Your accounts" />);
    await settle();
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });
});
