// @vitest-environment jsdom
import { act } from "react";
import { type Root, createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtEnquiryForm } from "./art-enquiry-form.client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
const action = vi.fn();

async function render(props: Partial<Parameters<typeof ArtEnquiryForm>[0]> = {}) {
  await act(async () => {
    root.render(
      <ArtEnquiryForm
        action={action}
        pending={false}
        contact={{ name: "", email: "", phone: "" }}
        serverErrors={{}}
        messageRequired
        messageMaxLength={2000}
        {...props}
      />,
    );
  });
}

const field = (name: string) =>
  host.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;

async function type(name: string, value: string) {
  const el = field(name);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    (host.querySelector("form") as HTMLFormElement).requestSubmit();
  });
}

beforeEach(() => {
  action.mockReset();
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("ArtEnquiryForm", () => {
  it("prefills the contact details and keeps them editable", async () => {
    await render({ contact: { name: "Iris Calder", email: "iris@example.com", phone: "0207" } });
    expect(field("name").value).toBe("Iris Calder");
    expect(field("email").value).toBe("iris@example.com");
    expect(field("contactPhone").value).toBe("0207");
    await type("name", "Iris C");
    expect(field("name").value).toBe("Iris C");
  });

  it("does not post an empty form and tells the visitor what to fix", async () => {
    await render();
    await submit();
    expect(action).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Enter a message.");
    for (const name of ["name", "email"]) {
      expect(field(name).getAttribute("aria-invalid")).toBe("true");
    }
  });

  it("does not post an invalid email", async () => {
    await render();
    await type("name", "Iris Calder");
    await type("email", "not-an-email");
    await type("message", "Is this still available?");
    await submit();
    expect(action).not.toHaveBeenCalled();
    expect(field("email").getAttribute("aria-invalid")).toBe("true");
  });

  it("posts the details once the checks pass", async () => {
    await render();
    await type("name", "Iris Calder");
    await type("email", "iris@example.com");
    await type("message", "Is this still available?");
    await submit();
    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0]?.[0] as FormData;
    expect(data.get("name")).toBe("Iris Calder");
    expect(data.get("email")).toBe("iris@example.com");
    expect(data.get("message")).toBe("Is this still available?");
    expect(data.get("website")).toBe("");
  });

  it("lets the message stay empty when it is optional", async () => {
    await render({ messageRequired: false });
    await type("name", "Iris Calder");
    await type("email", "iris@example.com");
    await submit();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("shows the errors the server sent back", async () => {
    await render({ serverErrors: { email: "That email address was refused." } });
    expect(host.textContent).toContain("That email address was refused.");
  });

  it("disables the button while sending", async () => {
    await render({ pending: true });
    const button = host.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Sending");
  });
});
