// @vitest-environment jsdom
import type { SignInMethodRowVm } from "@/server/domain/account-sign-in-methods.vm";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
const add = vi.fn();
const rename = vi.fn();
const remove = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  removeSignInMethodAction: vi.fn(),
  startSignInMethodAddAction: (kind: string) => add(kind),
  renamePasskeyAction: (id: string, name: string) => rename(id, name),
  removePasskeyAction: (id: string) => remove(id),
}));

const { SignInMethodsList } = await import("./sign-in-methods-list.client");

const ISSUER_URL = "https://auth.example.com/account-action?ticket=abc";
const assign = vi.fn();

const password: SignInMethodRowVm = {
  kind: "password",
  title: "Password",
  isSet: true,
  status: "Set",
  detail: "Sign in with your email and password.",
  actionLabel: "Change",
};

const confirm = (name: string) => ({
  title: `Remove "${name}"?`,
  body: "You won't be able to sign in with this passkey any more.",
  note: "The passkey stays saved on the device until you delete it there too.",
  confirmLabel: "Remove passkey",
});
const item = (id: string, name: string, blockedReason: string | null = null) => ({
  id,
  name,
  hint: id === "pk-1" ? "Synced to your other devices" : "This security key only",
  addedOn: "Tue 3 Nov 2026",
  lastUsed: "Last used today",
  blockedReason,
  confirm: confirm(name),
});
const passkeys = (
  items: ReturnType<typeof item>[],
  extra: { addBlockedReason?: string | null } = {},
): SignInMethodRowVm => ({
  kind: "passkeys",
  title: "Passkeys",
  count: items.length,
  detail: "Sign in with your face, fingerprint or screen lock.",
  detailLong: "Sign in with your face, fingerprint or screen lock. No password to type.",
  addLabel: "Add a passkey",
  busyLabel: "Opening…",
  addBlockedReason: extra.addBlockedReason ?? null,
  items,
});

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
  for (const mock of [refresh, add, rename, remove, assign]) mock.mockReset();
});

describe("Passkeys row", () => {
  it("invites with one Add button when there are no passkeys, and shows no count", () => {
    renderList([password, passkeys([])]);
    expect(screen.getByText("Passkeys")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add a passkey" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Rename/ })).toBeNull();
    expect(screen.queryByText("0")).toBeNull();
  });

  it("lists each passkey with its name, where it is kept, when it was added and last used", () => {
    renderList([password, passkeys([item("pk-1", "iCloud Keychain"), item("pk-2", "YubiKey 5")])]);
    const row = document.querySelector('[data-passkey-id="pk-1"]');
    expect(row?.textContent).toContain("iCloud Keychain");
    expect(row?.textContent).toContain("Synced to your other devices");
    expect(row?.textContent).toContain("Added Tue 3 Nov 2026");
    expect(row?.textContent).toContain("Last used today");
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("names the passkey on every button so a screen reader can tell them apart", () => {
    renderList([password, passkeys([item("pk-1", "iCloud Keychain"), item("pk-2", "YubiKey 5")])]);
    for (const name of ["iCloud Keychain", "YubiKey 5"]) {
      expect(screen.getByRole("button", { name: `Rename ${name}` })).toBeTruthy();
      expect(screen.getByRole("button", { name: `Remove ${name}` })).toBeTruthy();
    }
  });
});

describe("Add a passkey", () => {
  it("hands the browser to the issuer's page, busy meanwhile, and blocks every other button", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    add.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderList([password, passkeys([item("pk-1", "iCloud Keychain")])]);
    fireEvent.click(screen.getByRole("button", { name: "Add a passkey" }));
    expect(add).toHaveBeenCalledWith("passkey");
    const busy = screen.getByRole("button", { name: "Opening…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(
      screen.getByRole("button", { name: "Remove iCloud Keychain" }).hasAttribute("disabled"),
    ).toBe(true);
    await act(async () => resolve({ status: "ok", url: ISSUER_URL }));
    expect(assign).toHaveBeenCalledWith(ISSUER_URL);
  });

  it("sends the person to confirm it's them, saying it is to add a way in", async () => {
    add.mockResolvedValue({ status: "reauth_required" });
    renderList([password, passkeys([])]);
    fireEvent.click(screen.getByRole("button", { name: "Add a passkey" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(assign.mock.calls[0]?.[0]).toBe(
      "/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth&reason=add_sign_in_method",
    );
  });

  it("shows a refusal under the row and lets the person try again", async () => {
    add.mockResolvedValue({
      status: "error",
      message: "Too many attempts. Wait a few minutes and try again.",
      refresh: false,
    });
    renderList([password, passkeys([])]);
    fireEvent.click(screen.getByRole("button", { name: "Add a passkey" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Too many attempts");
    expect(screen.getByRole("button", { name: "Add a passkey" }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("is disabled at the limit, and the reason is its description", () => {
    const reason = "You have 10 passkeys, the most an account can have. Remove one to add another.";
    renderList([
      password,
      passkeys([item("pk-1", "iCloud Keychain")], { addBlockedReason: reason }),
    ]);
    const button = screen.getByRole("button", { name: "Add a passkey" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const described = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(described?.textContent).toBe(reason);
    fireEvent.click(button);
    expect(add).not.toHaveBeenCalled();
  });
});

describe("Rename a passkey", () => {
  function open() {
    renderList([password, passkeys([item("pk-1", "iCloud Keychain")])]);
    fireEvent.click(screen.getByRole("button", { name: "Rename iCloud Keychain" }));
    return screen.getByRole("dialog");
  }

  it("opens a dialog with the current name and what it was added as", () => {
    const dialog = open();
    expect(within(dialog).getByText("Rename passkey")).toBeTruthy();
    expect((within(dialog).getByLabelText("Name") as HTMLInputElement).value).toBe(
      "iCloud Keychain",
    );
    expect(dialog.textContent).toContain("Added Tue 3 Nov 2026 · Synced to your other devices");
  });

  it("saves the new name, closes, and tells the person", async () => {
    rename.mockResolvedValue({ status: "ok", message: "Passkey renamed." });
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Studio iMac" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(rename).toHaveBeenCalledWith("pk-1", "Studio iMac"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Passkey renamed.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("says inline what is wrong with an empty or too long name, without asking the server", () => {
    const dialog = open();
    const field = within(dialog).getByLabelText("Name");
    fireEvent.change(field, { target: { value: "  " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Enter a name for this passkey.");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(within(dialog).getByRole("alert").id);
    fireEvent.change(field, { target: { value: "x".repeat(41) } });
    expect(within(dialog).queryByRole("alert")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Use 40 characters or fewer.");
    expect(rename).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows the server's reason inline when saving fails", async () => {
    rename.mockResolvedValue({ status: "error", message: "We couldn't do that just now." });
    const dialog = open();
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Studio" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("couldn't do that");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes with Cancel without changing anything", () => {
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(rename).not.toHaveBeenCalled();
  });
});

describe("Remove a passkey", () => {
  function open(rows = passkeys([item("pk-1", "iCloud Keychain"), item("pk-2", "YubiKey 5")])) {
    renderList([password, rows]);
    fireEvent.click(screen.getByRole("button", { name: "Remove YubiKey 5" }));
    return screen.getByRole("dialog");
  }

  it("asks first, saying what will happen, and removes nothing until confirmed", () => {
    const dialog = open();
    expect(within(dialog).getByText('Remove "YubiKey 5"?')).toBeTruthy();
    expect(dialog.textContent).toContain("The passkey stays saved on the device");
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the chosen passkey, closes, tells the person and reloads the list", async () => {
    remove.mockResolvedValue({
      status: "ok",
      message: "Passkey removed. We've emailed you to confirm.",
    });
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove passkey" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("pk-2"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText("Passkey removed. We've emailed you to confirm.")).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("sends the person to confirm it's them, saying it is to remove a way in", async () => {
    remove.mockResolvedValue({ status: "reauth_required" });
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove passkey" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(assign.mock.calls[0]?.[0]).toBe(
      "/api/auth/login?returnTo=%2Faccount%2Fsecurity&intent=reauth&reason=remove_sign_in_method",
    );
  });

  it("shows the refusal in the dialog and keeps the passkey when the issuer says no", async () => {
    remove.mockResolvedValue({
      status: "error",
      message:
        "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.",
    });
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove passkey" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain(
      "only way you can sign in",
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("disables Remove on the last way in and says why beside it", () => {
    const reason =
      "This is the only way you can sign in. Add a passkey or a password first, then you can remove it.";
    renderList([passkeys([item("pk-1", "iCloud Keychain", reason)])]);
    const button = screen.getByRole("button", { name: "Remove iCloud Keychain" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(
      document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe(reason);
    expect(
      screen.getByRole("button", { name: "Rename iCloud Keychain" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("cancels without removing", () => {
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(remove).not.toHaveBeenCalled();
  });
});
