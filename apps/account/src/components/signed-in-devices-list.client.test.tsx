// @vitest-environment jsdom
import type { SessionRowVm } from "@/server/domain/account-sessions.vm";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const actions = vi.hoisted(() => ({
  signOutDeviceAction: vi.fn(),
  signOutOtherDevicesAction: vi.fn(),
}));
vi.mock("@/server/application/account-identity-actions.server", () => actions);

const { SignedInDevicesList } = await import("./signed-in-devices-list.client");

afterEach(cleanup);

const row = (id: string, isCurrent = false): SessionRowVm => ({
  id,
  deviceLabel: `Chrome on macOS ${id}`,
  deviceKind: "laptop",
  activity: "Last active 2 hours ago · United Kingdom",
  signedIn: "Signed in Mon 9 Nov · LAX Bid",
  isCurrent,
});

function renderList(otherCount: number) {
  const others = Array.from({ length: otherCount }, (_, i) => row(`d${i + 1}`));
  render(<SignedInDevicesList sessions={{ current: row("now", true), others }} returnTo="/x" />);
}

describe("SignedInDevicesList", () => {
  it("lists this device first, then only the 4 most recent others, then the real count", () => {
    renderList(22);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(5);
    expect(items[0]?.textContent).toContain("This device");
    expect(items[1]?.textContent).toContain("Chrome on macOS d1");
    expect(screen.getAllByRole("button", { name: /^Sign out Chrome/ })).toHaveLength(4);
    const more = screen.getByRole("button", { name: "Show 18 more devices" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("button", { name: "Sign out everywhere else" })).toBeTruthy();
  });

  it("shows no Show more button at 4 others or fewer", () => {
    renderList(4);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });

  it("uses the singular for one more device", () => {
    renderList(5);
    expect(screen.getByRole("button", { name: "Show 1 more device" })).toBeTruthy();
  });

  it("reveals the rest in place, each with its own Sign out, and focuses the first revealed row", () => {
    renderList(7);
    fireEvent.click(screen.getByRole("button", { name: "Show 3 more devices" }));
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(8);
    expect(screen.getAllByRole("button", { name: /^Sign out Chrome/ })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: /Show \d+ more/ })).toBeNull();
    expect(document.activeElement).toBe(items[5]);
    expect(items[5]?.textContent).toContain("Chrome on macOS d5");
  });

  it("names the device that was signed out, in a polite message", async () => {
    actions.signOutDeviceAction.mockResolvedValue({ status: "ok", message: "ignored" });
    renderList(2);
    fireEvent.click(screen.getByRole("button", { name: "Sign out Chrome on macOS d1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Chrome on macOS d1 is signed out."),
    );
    expect(actions.signOutDeviceAction).toHaveBeenCalledWith("d1");
  });

  it("says one other device, or everywhere else, once the others are signed out", async () => {
    actions.signOutOtherDevicesAction.mockResolvedValue({ status: "ok", message: "ignored" });
    renderList(1);
    fireEvent.click(screen.getByRole("button", { name: "Sign out everywhere else" }));
    fireEvent.click(
      await screen
        .findAllByRole("button", { name: "Sign out everywhere else" })
        .then((all) => all.at(-1) as HTMLElement),
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("Your other device is signed out."),
    );
  });
});
