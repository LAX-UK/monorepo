import { BackupCodesDisplay } from "@/components/auth/backup-codes-display";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("BackupCodesDisplay", () => {
  it("requires confirmation before Done when requireConfirmation is set", () => {
    const onConfirm = vi.fn();
    render(
      <BackupCodesDisplay
        codes={["AAAA1111", "BBBB2222"]}
        requireConfirmation
        onConfirm={onConfirm}
      />,
    );

    const done = screen.getByRole("button", { name: /done/i });
    expect(done).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /saved these codes/i }));
    expect(done).not.toBeDisabled();

    fireEvent.click(done);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
