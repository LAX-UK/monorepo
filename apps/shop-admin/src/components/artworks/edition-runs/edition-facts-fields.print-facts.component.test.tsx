// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const parties = vi.hoisted(() => ({
  current: { status: "ready", names: ["Coriander Studio, London", "Kestrel Editions"] } as
    | { status: "loading" }
    | { status: "ready"; names: readonly string[] }
    | { status: "failed" },
}));

vi.mock("@/components/artworks/edition-runs/use-print-parties.client", () => ({
  usePrintParties: () => parties.current,
}));

const { EditionFactsFields } = await import("./edition-facts-fields.client");
const { emptyFactsForm } = await import("@/lib/edition-facts-form");

const base = {
  ...emptyFactsForm(),
  signature: "unsigned" as const,
  numbering: "none" as const,
  certificate: "included" as const,
  form: "paper" as const,
  arrives: "with_print" as const,
};

function renderFields(
  values: Partial<ReturnType<typeof emptyFactsForm>> = {},
  errors: Record<string, string> = {},
  readOnly = false,
) {
  return render(
    <EditionFactsFields
      values={{ ...base, ...values }}
      errors={errors}
      spec={{ type: "lax_standard" }}
      readOnly={readOnly}
      onChange={vi.fn()}
    />,
  );
}

afterEach(() => {
  cleanup();
  parties.current = { status: "ready", names: ["Coriander Studio, London", "Kestrel Editions"] };
});

describe("the print facts in the Edition facts card", () => {
  it("offers the four stamps, with no stamp first and chosen by default", () => {
    renderFields({ issuer: "artist" });
    const stamp = screen.getByRole("group", { name: "Stamp" });
    const radios = Array.from(stamp.querySelectorAll('input[type="radio"], button[role="radio"]'));
    expect(radios).toHaveLength(4);
    expect(screen.getByText("No stamp")).toBeTruthy();
    expect(screen.getByText("Blind stamp of the publisher")).toBeTruthy();
    expect(screen.getByText("Blind stamp of the printer")).toBeTruthy();
    expect(screen.getByText("Estate stamp on the back")).toBeTruthy();
  });

  it("asks for the authority to certify only when London Art Exchange issues the certificate", () => {
    renderFields({ issuer: "artist" });
    expect(screen.queryByText("Authority to certify")).toBeNull();
    cleanup();
    renderFields({ issuer: "lax" });
    expect(screen.getByText("Authority to certify")).toBeTruthy();
    expect(
      screen.getByText(
        "London Art Exchange issues a certificate only on the written authority of the artist or their estate.",
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Dated")).toBeTruthy();
    expect(screen.getByLabelText("Where the signed letter is kept")).toBeTruthy();
  });

  it("shows what is missing against each authority field", () => {
    renderFields(
      { issuer: "lax" },
      {
        authorityGivenBy: "Say whether the artist or their estate gave the authority",
        authorityDatedOn: "Enter the date of the letter",
        authorityReference: "Say where the signed letter is kept",
      },
    );
    expect(screen.getByText("Enter the date of the letter")).toBeTruthy();
    expect(screen.getByText("Say where the signed letter is kept")).toBeTruthy();
    expect(
      screen.getByText("Say whether the artist or their estate gave the authority"),
    ).toBeTruthy();
  });

  it("says when the printers and publishers list is empty, and where to add names", () => {
    parties.current = { status: "ready", names: [] };
    renderFields({ issuer: "artist" });
    expect(
      screen.getByText("No names yet. Add them in Settings › Printers and publishers."),
    ).toBeTruthy();
  });

  it("says when the list could not be loaded, never showing it as empty", () => {
    parties.current = { status: "failed" };
    renderFields({ issuer: "artist" });
    expect(screen.getByText("Printers and publishers could not be loaded")).toBeTruthy();
    expect(screen.queryByText(/No names yet/)).toBeNull();
  });

  it("keeps a saved printer visible after it was removed from the list", () => {
    parties.current = { status: "ready", names: ["Kestrel Editions"] };
    renderFields({ issuer: "artist", printedBy: "Old Press, Leeds" });
    expect(screen.getByText("Old Press, Leeds")).toBeTruthy();
  });

  it("reads back the recorded print facts when the facts are locked", () => {
    renderFields(
      {
        issuer: "lax",
        authorityGivenBy: "estate",
        authorityDatedOn: "2026-09-12",
        authorityReference: "Letter in the estate file",
        stamp: "printer_blind",
        printedBy: "Coriander Studio, London",
        publishedBy: "name:Kestrel Editions",
      },
      {},
      true,
    );
    expect(screen.getByText("Authority to certify")).toBeTruthy();
    expect(screen.getByText("The artist's estate, letter dated 2026-09-12")).toBeTruthy();
    expect(screen.getByText("Blind stamp of the printer")).toBeTruthy();
    expect(screen.getByText("Coriander Studio, London")).toBeTruthy();
    expect(screen.getByText("Kestrel Editions")).toBeTruthy();
    // The letter's whereabouts are for staff and are not part of the read-only summary.
    expect(screen.queryByText("Letter in the estate file")).toBeNull();
  });
});
