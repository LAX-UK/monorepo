"use client";

import * as React from "react";
import { Button, type ButtonProps } from "./button.js";

export type FilePickerButtonProps = Omit<ButtonProps, "onClick" | "type" | "asChild"> & {
  /** Called with the chosen files; the same file can be chosen again afterwards. */
  onFiles: (files: File[]) => void;
  /** Accepted media types, e.g. "application/pdf,image/jpeg". */
  accept?: string;
  multiple?: boolean;
};

/**
 * A LAX button that opens the file chooser: the native file input stays hidden inside, so pages
 * never draw one. Takes the button's look, icon and `disabledReason` (the chooser does not open
 * while a reason is given).
 */
export function FilePickerButton({
  onFiles,
  accept,
  multiple = false,
  disabledReason,
  disabled,
  children,
  ...button
}: FilePickerButtonProps) {
  const input = React.useRef<HTMLInputElement>(null);
  const blocked = Boolean(disabledReason) || Boolean(disabled);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = event.target.files ? [...event.target.files] : [];
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
      <Button
        {...button}
        {...(disabledReason ? { disabledReason } : {})}
        disabled={disabled}
        onClick={() => {
          if (!blocked) input.current?.click();
        }}
      >
        {children}
      </Button>
    </>
  );
}
