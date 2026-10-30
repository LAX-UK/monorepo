import { Field } from "@auction/ui/lax";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RichTextField } from "./rich-text-field";
import type { RichTextSpan } from "./rich-text-model";

const isSafeHref = (href: string) => /^(https:\/\/|mailto:|\/(?![/\\]))/.test(href);
const execCommand = vi.fn();

beforeEach(() => {
  execCommand.mockReset();
  document.execCommand = execCommand;
});

function setup(value: RichTextSpan[], extra: { disabled?: boolean } = {}) {
  const onChange = vi.fn();
  render(
    <Field label="Paragraph" id="p">
      <RichTextField
        value={value}
        onChange={onChange}
        isSafeHref={isSafeHref}
        hrefHint="Use https://, mailto: or a site path such as /visit."
        {...extra}
      />
    </Field>,
  );
  return { onChange, box: screen.getByRole("textbox", { name: /paragraph/i }) };
}

describe("RichTextField", () => {
  it("shows existing formatting as formatting, not as data", () => {
    const { box } = setup([
      { text: "Hello " },
      { text: "world", marks: ["bold"] },
      { text: " now", marks: ["italic"] },
      { text: " link", marks: ["link"], href: "/visit" },
    ]);
    expect(box.querySelector("strong")?.textContent).toBe("world");
    expect(box.querySelector("em")?.textContent).toBe(" now");
    expect(box.querySelector("a")?.getAttribute("href")).toBe("/visit");
    expect(box.textContent).not.toContain("{");
  });

  it("reports typing as runs in the block format", () => {
    const { box, onChange } = setup([{ text: "" }]);
    box.innerHTML = "Hi <b>there</b>";
    fireEvent.input(box);
    expect(onChange).toHaveBeenLastCalledWith([
      { text: "Hi " },
      { text: "there", marks: ["bold"] },
    ]);
  });

  it("applies bold and italic from the toolbar", () => {
    const { onChange } = setup([{ text: "x" }]);
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(execCommand).toHaveBeenCalledWith("bold");
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    expect(execCommand).toHaveBeenCalledWith("italic");
    expect(onChange).toHaveBeenCalled();
  });

  it("adds a line break on Enter instead of a new block", () => {
    const { box } = setup([{ text: "x" }]);
    fireEvent.keyDown(box, { key: "Enter" });
    expect(execCommand).toHaveBeenCalledWith("insertLineBreak");
  });

  it("pastes plain text", () => {
    const { box } = setup([{ text: "" }]);
    fireEvent.paste(box, { clipboardData: { getData: () => "a\r\nb" } });
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "a\nb");
  });

  it("will not open the link box with nothing selected", () => {
    setup([{ text: "x" }]);
    const link = screen.getByRole("button", { name: "Add link" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(link);
    expect(screen.queryByLabelText("Link address")).not.toBeInTheDocument();
  });

  it("disables editing and every control when disabled", () => {
    const { box } = setup([{ text: "x" }], { disabled: true });
    expect(box).toHaveAttribute("contenteditable", "false");
    expect(screen.getByRole("button", { name: "Bold" })).toBeDisabled();
  });

  it("takes its label, id and error from the field", () => {
    render(
      <Field label="Answer" id="a" error="Enter the answer.">
        <RichTextField
          value={[{ text: "" }]}
          onChange={vi.fn()}
          isSafeHref={isSafeHref}
          hrefHint=""
        />
      </Field>,
    );
    const box = screen.getByRole("textbox", { name: "Answer" });
    expect(box).toHaveAttribute("id", "a");
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box.getAttribute("aria-describedby")).toContain("a-error");
  });
});
