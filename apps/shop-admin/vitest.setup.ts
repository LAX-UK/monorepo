import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Component tests opt in to jsdom per file; the node unit tests have no DOM to clean up.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
