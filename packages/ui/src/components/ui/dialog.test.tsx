import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog.js";

const open = (className?: string) =>
  render(
    <Dialog open>
      <DialogContent className={className}>
        <DialogTitle>Rename</DialogTitle>
        <DialogDescription>Choose a new name.</DialogDescription>
      </DialogContent>
    </Dialog>,
  );

describe("DialogContent on a phone", () => {
  it("keeps a 16px gutter either side and rounded corners at every width", () => {
    open();
    const { className } = screen.getByRole("dialog");
    expect(className).toContain("w-[calc(100%-2rem)]");
    expect(className).toContain("max-w-lg");
    expect(className).toContain("rounded-lg");
    expect(className).not.toContain("sm:rounded-lg");
  });

  it("lets a caller still set its own width and radius", () => {
    open("w-auto rounded-none");
    const { className } = screen.getByRole("dialog");
    expect(className).toContain("w-auto");
    expect(className).toContain("rounded-none");
    expect(className).not.toContain("w-[calc(100%-2rem)]");
  });
});
