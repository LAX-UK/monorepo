import { DATA_REQUEST_ERRORS } from "@auction/identity-contracts/data-requests";
import { describe, expect, it } from "vitest";
import {
  DATA_REQUEST_ERROR_COPY,
  dataRequestErrorMessage,
  isStaleDataRequest,
} from "./data-request-errors";

describe("data request errors", () => {
  it("has a sentence for every refusal Identity can give", () => {
    expect(Object.keys(DATA_REQUEST_ERROR_COPY).sort()).toEqual([...DATA_REQUEST_ERRORS].sort());
  });

  it("says Identity's own refusal, or that nothing changed when it did not answer", () => {
    expect(dataRequestErrorMessage("already_extended", 422)).toBe(
      "This request has already been extended once.",
    );
    expect(dataRequestErrorMessage(undefined, 503)).toMatch(/Nothing was changed/);
    expect(dataRequestErrorMessage("data_requests_unavailable", 503)).toMatch(
      /Nothing was changed/,
    );
    expect(dataRequestErrorMessage(undefined, 403)).toMatch(/permission/);
  });

  it("tells a stale edit apart", () => {
    expect(isStaleDataRequest("stale_version")).toBe(true);
    expect(isStaleDataRequest("not_open")).toBe(false);
  });
});
