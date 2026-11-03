// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlertLinkPage } from "./alert-link-page.js";

const Link = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href}>{children}</a>
);

afterEach(cleanup);

describe("AlertLinkPage confirm", () => {
  const ready = { state: "ready", maskedEmail: "m•••@example.com" } as const;

  it("shows the address and changes nothing until the button is pressed", () => {
    const onConfirm = vi.fn();
    render(
      <AlertLinkPage kind="confirm" product="bid" Link={Link} link={ready} onConfirm={onConfirm} />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Confirm sale alerts" })).toBeTruthy();
    expect(screen.getByText(/m•••@example.com/)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirms on the press and then says the alerts are on", async () => {
    const onConfirm = vi.fn().mockResolvedValue("confirmed");
    render(
      <AlertLinkPage kind="confirm" product="bid" Link={Link} link={ready} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm sale alerts" }));
    await waitFor(() => expect(screen.getByText("Sale alerts are on")).toBeTruthy());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "See upcoming sales" }).getAttribute("href")).toBe(
      "/sales",
    );
  });

  it("says the same for a second press as for the first", () => {
    render(
      <AlertLinkPage
        kind="confirm"
        product="bid"
        Link={Link}
        link={{ state: "already_confirmed" }}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("Sale alerts are on")).toBeTruthy();
  });

  it("offers to ask again when the link expired or does not work", () => {
    const { rerender } = render(
      <AlertLinkPage
        kind="confirm"
        product="bid"
        Link={Link}
        link={{ state: "expired" }}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("This link has expired")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ask again" })).toBeTruthy();
    rerender(
      <AlertLinkPage
        kind="confirm"
        product="bid"
        Link={Link}
        link={{ state: "invalid" }}
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.getByText("This link doesn't work")).toBeTruthy();
  });

  it("keeps the button available after a service error", async () => {
    const onConfirm = vi.fn().mockResolvedValue("failed");
    render(
      <AlertLinkPage kind="confirm" product="bid" Link={Link} link={ready} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm sale alerts" }));
    await waitFor(() => expect(screen.getByText("We couldn't confirm just now")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("button", { name: "Confirm sale alerts" })).toBeTruthy();
  });
});

describe("AlertLinkPage stop", () => {
  const topics = [
    { id: "bid.new_sales", label: "new sales" },
    { id: "bid.searches", label: "saved searches" },
  ];

  it("stops everything for a visitor with one topic", async () => {
    const onStop = vi.fn().mockResolvedValue("stopped");
    render(
      <AlertLinkPage
        kind="stop"
        product="bid"
        Link={Link}
        link={{
          state: "ready",
          maskedEmail: "a•••@example.com",
          topics: [topics[0] as never],
          fromTopic: null,
        }}
        onStop={onStop}
      />,
    );
    expect(screen.queryByRole("button", { name: /Only stop/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop sale alerts" }));
    await waitFor(() => expect(screen.getByText("Sale alerts stopped")).toBeTruthy());
    expect(onStop).toHaveBeenCalledWith({ scope: "all" });
  });

  it("offers all topics or only the one the email came from", async () => {
    const onStop = vi.fn().mockResolvedValue("stopped");
    render(
      <AlertLinkPage
        kind="stop"
        product="bid"
        Link={Link}
        link={{
          state: "ready",
          maskedEmail: "a•••@example.com",
          topics,
          fromTopic: { id: "bid.searches", label: "saved search" },
        }}
        onStop={onStop}
      />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Stop LAX Bid alert emails?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Only stop saved search emails" }));
    await waitFor(() =>
      expect(onStop).toHaveBeenCalledWith({ scope: "topic", topic: "bid.searches" }),
    );
  });

  it("says an already stopped address is already off, and an invalid link does not work", () => {
    const { rerender } = render(
      <AlertLinkPage
        kind="stop"
        product="bid"
        Link={Link}
        link={{ state: "already_stopped" }}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("These emails are already off")).toBeTruthy();
    rerender(
      <AlertLinkPage
        kind="stop"
        product="bid"
        Link={Link}
        link={{ state: "invalid" }}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText("This link doesn't work")).toBeTruthy();
  });
});
