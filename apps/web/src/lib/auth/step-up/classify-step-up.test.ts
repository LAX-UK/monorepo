import { describe, expect, it } from "vitest";
import {
  classifyActionFailure,
  classifyStepUpError,
  classifyStepUpFromResponse,
} from "./classify-step-up";

describe("classifyStepUpFromResponse", () => {
  it("returns recent_auth_required for 403 + code", () => {
    expect(classifyStepUpFromResponse(403, { code: "recent_auth_required" })).toBe(
      "recent_auth_required",
    );
  });
  it("returns credential_required for 403 + code", () => {
    expect(classifyStepUpFromResponse(403, { code: "credential_required" })).toBe(
      "credential_required",
    );
  });
  it("returns null for 403 unknown code", () => {
    expect(classifyStepUpFromResponse(403, { code: "forbidden" })).toBeNull();
  });
  it("returns null for non-403", () => {
    expect(classifyStepUpFromResponse(401, { code: "recent_auth_required" })).toBeNull();
  });
});

describe("classifyActionFailure", () => {
  it("maps 404 to not_found", () => {
    expect(classifyActionFailure(404, {})).toBe("not_found");
  });
  it("maps unknown to server_error", () => {
    expect(classifyActionFailure(500, {})).toBe("server_error");
  });
});

describe("classifyStepUpError", () => {
  it("is an alias of classifyStepUpFromResponse", () => {
    expect(classifyStepUpError).toBe(classifyStepUpFromResponse);
  });
});
