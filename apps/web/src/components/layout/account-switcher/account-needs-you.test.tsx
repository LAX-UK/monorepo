import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountNeedsYouProvider, useAccountNeedsYou } from "./account-needs-you";

function Probe() {
  const { counts, request } = useAccountNeedsYou();
  return (
    <button type="button" onClick={request}>
      {counts ? JSON.stringify(counts) : "none"}
    </button>
  );
}

describe("AccountNeedsYouProvider", () => {
  it("reads nothing until asked, then reuses a fresh answer for a minute", async () => {
    let clock = 0;
    const read = vi.fn(async () => ({ org: 1 }));
    render(
      <AccountNeedsYouProvider enabled read={read} now={() => clock}>
        <Probe />
      </AccountNeedsYouProvider>,
    );
    expect(read).not.toHaveBeenCalled();
    const button = screen.getByRole("button");
    await act(async () => button.click());
    expect(button).toHaveTextContent('{"org":1}');
    clock = 30_000;
    await act(async () => button.click());
    expect(read).toHaveBeenCalledTimes(1);
    clock = 61_000;
    await act(async () => button.click());
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("never reads while off", async () => {
    const read = vi.fn(async () => ({ org: 1 }));
    render(
      <AccountNeedsYouProvider enabled={false} read={read}>
        <Probe />
      </AccountNeedsYouProvider>,
    );
    await act(async () => screen.getByRole("button").click());
    expect(read).not.toHaveBeenCalled();
  });

  it("tries again on the next open after a failed read", async () => {
    const read = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue({ org: 3 });
    render(
      <AccountNeedsYouProvider enabled read={read}>
        <Probe />
      </AccountNeedsYouProvider>,
    );
    const button = screen.getByRole("button");
    await act(async () => button.click());
    expect(button).toHaveTextContent("none");
    await act(async () => button.click());
    expect(button).toHaveTextContent('{"org":3}');
  });
});
