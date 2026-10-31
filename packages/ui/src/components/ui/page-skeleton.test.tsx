import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageSkeleton, type PageSkeletonVariant } from "./page-skeleton.js";

describe("PageSkeleton", () => {
  it.each<[PageSkeletonVariant, string]>([
    ["dashboard", "Loading dashboard"],
    ["table", "Loading"],
    ["grid", "Loading"],
    ["checkout", "Loading checkout"],
  ])("announces the %s skeleton as a busy status with a name", (variant, name) => {
    render(<PageSkeleton variant={variant} />);
    // A name on a plain div is not allowed; the output element is a status and carries it.
    expect(screen.getByRole("status", { name })).toHaveAttribute("aria-busy", "true");
  });
});
