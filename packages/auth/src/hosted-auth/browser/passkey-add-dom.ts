import { PASSKEY_COPY } from "../passkey-copy.js";
import { type RenameCall, createPasskeyAdd } from "./passkey-add.js";
import { browserPasskeyRuntime } from "./passkey-ceremony.js";
import type { HostedAuthApi } from "./window-auth.js";

const COPY = PASSKEY_COPY.add;

function el<T extends HTMLElement>(id: string, kind: new () => T): T | null {
  const node = document.getElementById(id);
  return node instanceof kind ? node : null;
}

function show(node: HTMLElement | null, visible: boolean): void {
  if (node) node.hidden = !visible;
}

/** Posts the new name to the issuer's own page route; true when it was saved. */
const renameOnIssuer: RenameCall = async (passkeyId, name) => {
  const response = await fetch("/account-action/passkey/rename", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passkeyId, name }),
  });
  return response.ok;
};

/** Connects the "Add a passkey" page to its controller. */
export function bindPasskeyAdd(auth: HostedAuthApi): void {
  const root = document.getElementById("passkey-add");
  const returnUrl = root?.getAttribute("data-return-url") ?? "/";
  const ready = document.getElementById("passkey-ready");
  const saved = document.getElementById("passkey-saved");
  const unsupported = document.getElementById("passkey-unsupported");
  const create = el("passkey-create", HTMLButtonElement);
  const cancel = document.getElementById("passkey-cancel");
  const note = document.getElementById("passkey-note");
  const title = document.querySelector("h1");
  const lead = document.querySelector(".heading .lead");
  const nameInput = el("passkey-name", HTMLInputElement);
  const saveButton = el("passkey-save", HTMLButtonElement);
  const savedLead = document.getElementById("passkey-saved-lead");
  const nameForm = document.getElementById("passkey-name-form");

  const controller = createPasskeyAdd({
    runtime: browserPasskeyRuntime,
    rename: renameOnIssuer,
    view: {
      busy(busy) {
        auth.setBusy(create, busy);
        if (create) create.disabled = busy;
        // Cancel stays available while the device is asked, so the person is never trapped.
      },
      quietNote(message) {
        if (!note) return;
        note.textContent = message ?? "";
        note.hidden = message === null;
      },
      summary(message) {
        if (message === null) auth.hideStatus();
        else auth.showError(message);
      },
      showUnsupported() {
        show(unsupported, true);
        show(create, false);
        show(cancel, false);
      },
      showSaved(passkey, syncNote) {
        auth.hideStatus();
        show(ready, false);
        show(saved, true);
        if (title) title.textContent = COPY.savedTitle;
        if (lead instanceof HTMLElement) lead.hidden = true;
        if (savedLead) savedLead.textContent = `${PASSKEY_COPY.add.savedLead} ${syncNote}`;
        if (nameInput) {
          nameInput.value = passkey.name;
          nameInput.focus();
          nameInput.select();
        }
      },
      nameError(message) {
        if (!nameInput) return;
        if (message === null) auth.clearFieldError(nameInput);
        else auth.applyFieldError(nameInput, message);
      },
      saving(saving) {
        auth.setBusy(saveButton, saving);
      },
      leave() {
        window.location.assign(returnUrl);
      },
    },
  });

  create?.addEventListener("click", () => {
    void controller.create();
  });
  nameForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void controller.save(nameInput?.value ?? "");
  });
  controller.start();
}
