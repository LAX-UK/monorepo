import type { OrganisationDocumentState } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { organisationDocumentStateView } from "./organisation-document-state";

const STATES = Object.keys({
  requested: true,
  received: true,
  in_review: true,
  accepted: true,
  needs_replacing: true,
} satisfies Record<OrganisationDocumentState, true>) as OrganisationDocumentState[];

describe("organisationDocumentStateView", () => {
  it.each([
    ["requested", "Not sent yet", "warning"],
    ["received", "Received", "neutral"],
    ["in_review", "Being checked", "info"],
    ["accepted", "Accepted", "success"],
    ["needs_replacing", "Needs replacing", "danger"],
  ] as const)("%s reads %s", (state, label, tone) => {
    expect(organisationDocumentStateView(state)).toEqual({ label, tone });
  });

  it.each(STATES)("%s is sentence case with no raw status", (state) => {
    const { label } = organisationDocumentStateView(state);
    expect(label).not.toMatch(/_/);
    expect(label.charAt(0)).toBe(label.charAt(0).toUpperCase());
    expect(label.slice(1)).toBe(label.slice(1).toLowerCase());
  });
});
