// @vitest-environment jsdom
import type { SignInMethodRowVm } from "@/server/domain/account-sign-in-methods.vm";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const start = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  removeSignInMethodAction: vi.fn(),
  startSignInMethodLinkAction: (provider: string) => start(provider),
}));

const { SignInMethodsList } = await import("./sign-in-methods-list.client");

const ISSUER_URL = "https://auth.example.com/account-action?ticket=abc";
const assign = vi.fn();

function deferred() {
  const holder: { resolve: (value: unknown) => void } = { resolve: () => undefined };
  const promise = new Promise<unknown>((resolve) => {
    holder.resolve = resolve;
  });
  return { promise, resolve: (value: unknown) => holder.resolve(value) };
}

const password: SignInMethodRowVm = {
  kind: "password",
  title: "Password",
  isSet: true,
  status: "Set",
  detail: "Sign in with your email and password.",
  actionLabel: "Change",
};
const linkRow = (provider: "google" | "apple"): SignInMethodRowVm => ({
  kind: "link",
  provider,
  title: provider === "google" ? "Google" : "Apple",
  detail: "Not linked.",
  detailMore: `Sign in with your ${provider === "google" ? "Google" : "Apple"} Account.`,
  actionLabel: `Link ${provider === "google" ? "Google" : "Apple"}`,
  busyLabel: `Opening ${provider === "google" ? "Google" : "Apple"}…`,
});
const linkedGoogle: SignInMethodRowVm = {
  kind: "social",
  provider: "google",
  title: "Google",
  address: "ada@gmail.com",
  linkedOn: "Linked Thu 1 Oct 2026",
  blockedReason: null,
};

function renderList(rows: SignInMethodRowVm[]) {
  return render(
    <SignInMethodsList
      rows={rows}
      hint={null}
      returnTo="/account/security"
      passwordPanel={<p>Password form</p>}
      twoStep={{ title: "Two-step verification", href: "https://auth.example/2fa" }}
    />,
  );
}

beforeEach(() => {
  vi.stubGlobal("location", { ...window.location, assign });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
  start.mockReset();
  assign.mockReset();
});

describe("Link rows", () => {
  it("offers Link Google and Link Apple for a provider that is not linked", () => {
    renderList([password, linkRow("google"), linkRow("apple")]);
    expect(screen.getByRole("button", { name: "Link Google" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Link Apple" })).toBeTruthy();
    expect(screen.getAllByText(/Not linked\./)).toHaveLength(2);
    expect(screen.getByText(/Sign in with your Google Account\./)).toBeTruthy();
  });

  it("hands the browser to the issuer's page, showing the busy label meanwhile", async () => {
    const pending = deferred();
    start.mockReturnValue(pending.promise);
    renderList([password, linkRow("google"), linkRow("apple")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    const busy = screen.getByRole("button", { name: "Opening Google…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(start).toHaveBeenCalledWith("google");
    // Nothing else can be started while the browser is on its way.
    expect(screen.getByRole("button", { name: "Link Apple" }).hasAttribute("disabled")).toBe(true);
    expect(busy.hasAttribute("disabled")).toBe(true);
    await act(async () => pending.resolve({ status: "ok", url: ISSUER_URL }));
    expect(assign).toHaveBeenCalledWith(ISSUER_URL);
    // It stays busy: the page is about to be replaced.
    expect(screen.getByRole("button", { name: "Opening Google…" })).toBeTruthy();
  });

  it("blocks Remove on a linked provider while a link is starting", async () => {
    start.mockReturnValue(new Promise(() => undefined));
    renderList([password, linkedGoogle, linkRow("apple")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Apple" }));
    expect(
      screen.getByRole("button", { name: "Remove Google sign-in" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("sends the person to sign in again when theirs is too old", async () => {
    start.mockResolvedValue({ status: "reauth_required" });
    renderList([password, linkRow("google")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(assign.mock.calls[0]?.[0]).toBe(
      "/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth",
    );
  });

  it("shows a refusal under its own row, and lets the person try again", async () => {
    start.mockResolvedValue({
      status: "error",
      message: "Too many attempts. Wait a few minutes and try again.",
      refresh: false,
    });
    renderList([password, linkRow("google"), linkRow("apple")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Too many attempts");
    expect(alert.closest("li")?.textContent).toContain("Google");
    expect(screen.getByRole("button", { name: "Link Google" }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(assign).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the list when the page was out of date", async () => {
    start.mockResolvedValue({
      status: "error",
      message: "That way to sign in is already linked to your account.",
      refresh: true,
    });
    renderList([password, linkRow("google")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    await screen.findByRole("alert");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("recovers when the browser's Back button restores the page mid-link", async () => {
    start.mockReturnValue(new Promise(() => undefined));
    renderList([password, linkRow("google")]);
    fireEvent.click(screen.getByRole("button", { name: "Link Google" }));
    expect(screen.getByRole("button", { name: "Opening Google…" })).toBeTruthy();
    const restored = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(restored, "persisted", { value: true });
    act(() => {
      window.dispatchEvent(restored);
    });
    expect(screen.getByRole("button", { name: "Link Google" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("marks each provider row with its own mark, hidden from screen readers", () => {
    const { container } = renderList([password, linkedGoogle, linkRow("apple")]);
    const marks = [...container.querySelectorAll("[data-provider-mark]")];
    expect(marks.map((mark) => mark.getAttribute("data-provider-mark"))).toEqual([
      "google",
      "apple",
    ]);
    for (const mark of marks) expect(mark.getAttribute("aria-hidden")).toBe("true");
  });
});
