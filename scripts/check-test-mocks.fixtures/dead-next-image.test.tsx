import { vi } from "vitest";
import { helper } from "./helper.js";

vi.mock("next/image", () => ({ default: () => null }));

void helper;
