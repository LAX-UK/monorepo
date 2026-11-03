import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadItem } from "./upload-item";

describe("UploadItem", () => {
  it("says what went wrong on the photo that failed, and offers another go", () => {
    render(
      <ul>
        <UploadItem
          item={{
            id: "1",
            fileName: "a.jpg",
            status: "error",
            message: "This photo didn't upload. Try again",
          }}
          onRetry={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("This photo didn't upload. Try again");
    expect(screen.getByRole("button", { name: "Retry upload" })).toBeInTheDocument();
  });

  it("offers no retry for a file that was refused, since the same file would fail again", () => {
    render(
      <ul>
        <UploadItem
          item={{
            id: "2",
            fileName: "huge.png",
            status: "error",
            message: "This photo is over 10 MB. Choose a smaller file",
            retryable: false,
          }}
          onRetry={vi.fn()}
        />
      </ul>,
    );
    expect(screen.queryByRole("button", { name: "Retry upload" })).not.toBeInTheDocument();
  });
});
