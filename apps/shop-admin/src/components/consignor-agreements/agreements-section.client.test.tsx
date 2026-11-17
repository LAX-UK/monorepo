// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type { AdminConsignorAgreement } from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addConsignorAgreement = vi.fn();
const replaceConsignorAgreement = vi.fn();
const retireConsignorAgreement = vi.fn();
const requestAgreementFileUpload = vi.fn();
const agreementFileLink = vi.fn();
const putWithProgress = vi.fn();
const refresh = vi.fn();
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/server/application/admin-consignor-agreement-actions.server", () => ({
  addConsignorAgreement,
  replaceConsignorAgreement,
  retireConsignorAgreement,
  requestAgreementFileUpload,
  agreementFileLink,
}));
vi.mock("@/lib/shop-media-upload.client", () => ({ putWithProgress }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/clients/p",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: toastError, warning: vi.fn() }),
  Toaster: () => null,
}));
vi.mock("@auction/ui/components/popover", async () =>
  (await import("@/test/radix-stubs")).popoverStub(),
);

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { AgreementsSection } = await import("./agreements-section.client");

const PARTY = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-11-17";
const KEEPER = ["client.read_all", "consignor_agreement.read", "consignor_agreement.manage"];
const READER = ["client.read_all", "consignor_agreement.read"];
const FILE_KEY = `private/consignor-agreements/${PARTY}/a.pdf`;

function agreement(patch: Partial<AdminConsignorAgreement> = {}): AdminConsignorAgreement {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    agreementId: "11111111-1111-4111-8111-111111111111",
    version: 1,
    partyId: PARTY,
    places: ["lax_bid", "lax_art"],
    startsOn: "2026-03-03",
    endsOn: "2027-03-02",
    lowestPricePence: 200_000,
    commissionBasisPoints: 2500,
    signedFileKey: FILE_KEY,
    note: null,
    status: "current",
    replacesId: null,
    createdAt: "2026-03-03T10:00:00.000Z",
    replacedAt: null,
    retiredAt: null,
    ...patch,
  };
}

function show(agreements: AdminConsignorAgreement[] | null, capabilities = KEEPER) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Administrator")}>
        <AgreementsSection
          partyId={PARTY}
          consignorName="Ivo Marren"
          agreements={agreements}
          today={TODAY}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Agreements section", () => {
  it("shows each agreement's places, state, dates, lowest price and commission", () => {
    show([agreement()]);
    const item = within(screen.getByRole("listitem", { name: "LAX Bid and lax.art" }));
    expect(item.getByText("In force")).toBeInTheDocument();
    expect(item.getByText(/to .*2 Mar 2027/)).toBeInTheDocument();
    expect(item.getByText("£2,000.00")).toBeInTheDocument();
    expect(item.getByText("25%")).toBeInTheDocument();
    expect(item.getByText(/Version 1, added/)).toBeInTheDocument();
  });

  it("lists in force first, then not started, expired and retired", () => {
    show([
      agreement({ id: "a-retired", status: "retired", retiredAt: "2026-10-01T09:00:00.000Z" }),
      agreement({ id: "a-expired", places: ["private_sale"], endsOn: "2026-06-30" }),
      agreement({ id: "a-later", places: ["lax_art"], startsOn: "2027-01-01", endsOn: null }),
      agreement({ id: "a-now", places: ["lax_bid"] }),
    ]);
    const states = screen
      .getAllByRole("listitem")
      .map((item) => within(item).getByText(/In force|Not started|Expired|Retired/).textContent);
    expect(states).toEqual(["In force", "Not started", "Expired", "Retired"]);
    expect(screen.getByText(/From .*1 Jan 2027, no end date/)).toBeInTheDocument();
  });

  it("says when no lowest price or commission was agreed", () => {
    show([agreement({ lowestPricePence: null, commissionBasisPoints: null })]);
    expect(screen.getByText("None agreed")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });

  it("keeps a long note whole, wrapped on its own lines", () => {
    const note = `${"Works on paper only, framed at LAX's cost. ".repeat(20)}\nCall before collecting.`;
    show([agreement({ note })]);
    const shown = screen
      .getAllByText((_, element) => element?.textContent === note)
      .find((element) => element.tagName === "SPAN" && element.children.length === 0);
    expect(shown).toHaveClass("whitespace-pre-line", "break-words");
  });

  it("offers no Replace or Retire on a retired agreement", () => {
    show([agreement({ status: "retired", retiredAt: "2026-10-01T09:00:00.000Z" })]);
    expect(screen.getByText("Retired")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Replace…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Signed file" })).toBeInTheDocument();
  });

  it("says there are none yet, and offers Add agreement to keepers only", () => {
    show([]);
    expect(screen.getByText("No agreements")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add agreement" })).toBeInTheDocument();
  });

  it("lets readers see agreements and open the file, without changing them", () => {
    show([agreement()], READER);
    expect(screen.queryByRole("button", { name: "Add agreement" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Replace…" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Retire…" })).toBeNull();
    expect(screen.getByRole("button", { name: "Signed file" })).toBeInTheDocument();
  });

  it("says the agreements did not load, with Try again", () => {
    show(null);
    expect(screen.getByText("The agreements did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add agreement" })).toBeNull();
  });

  it("opens the signed file through a short-lived link, and says when it cannot", async () => {
    agreementFileLink.mockResolvedValue({
      ok: false,
      message: "The signed file could not be opened. Try again in a moment.",
    });
    show([agreement()]);
    fireEvent.click(screen.getByRole("button", { name: "Signed file" }));
    await waitFor(() =>
      expect(agreementFileLink).toHaveBeenCalledWith({ partyId: PARTY, versionId: agreement().id }),
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "The signed file could not be opened. Try again in a moment.",
      ),
    );
  });
});

describe("adding an agreement", () => {
  async function openAdd() {
    show([]);
    fireEvent.click(screen.getByRole("button", { name: "Add agreement" }));
    return within(await screen.findByRole("dialog", { name: "Add agreement" }));
  }

  it("lists what is missing at the top and beside each field, before sending", async () => {
    const dialog = await openAdd();
    fireEvent.click(dialog.getByRole("button", { name: "Add agreement" }));
    expect(await dialog.findByText("Places: Choose at least one place.")).toBeInTheDocument();
    expect(dialog.getByText("Starts: Enter the day the agreement starts.")).toBeInTheDocument();
    expect(dialog.getByText("Signed agreement: Upload the signed agreement.")).toBeInTheDocument();
    expect(addConsignorAgreement).not.toHaveBeenCalled();
  });

  it("uploads the signed file when it is chosen, then sends the terms with its key", async () => {
    requestAgreementFileUpload.mockResolvedValue({
      ok: true,
      data: { key: FILE_KEY, uploadUrl: "https://storage.test/put", requiredHeaders: {} },
    });
    putWithProgress.mockResolvedValue(undefined);
    addConsignorAgreement.mockResolvedValue({ ok: true, data: agreement() });
    const dialog = await openAdd();
    fireEvent.click(dialog.getByRole("checkbox", { name: "LAX Bid" }));
    fireEvent.click(dialog.getByRole("checkbox", { name: "Private sale" }));
    fireEvent.change(dialog.getByLabelText("Starts"), { target: { value: "3/3/2026" } });
    fireEvent.blur(dialog.getByLabelText("Starts"));
    fireEvent.change(dialog.getByLabelText(/Commission/), { target: { value: "25" } });
    const file = new File(["%PDF-1.7"], "Ivo Marren agreement.pdf", { type: "application/pdf" });
    fireEvent.change(dialog.getByLabelText(/Upload the signed agreement/), {
      target: { files: [file] },
    });
    expect(await dialog.findByText("Ivo Marren agreement.pdf")).toBeInTheDocument();
    expect(requestAgreementFileUpload).toHaveBeenCalledWith({
      partyId: PARTY,
      contentType: "application/pdf",
      byteSize: file.size,
    });
    fireEvent.change(dialog.getByRole("textbox", { name: /Note/ }), {
      target: { value: "  Signed at the gallery  " },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Add agreement" }));
    await waitFor(() => expect(addConsignorAgreement).toHaveBeenCalledOnce());
    expect(addConsignorAgreement.mock.calls[0]?.[0]).toMatchObject({
      partyId: PARTY,
      terms: {
        places: ["lax_bid", "private_sale"],
        startsOn: "2026-03-03",
        endsOn: null,
        lowestPricePence: null,
        commissionBasisPoints: 2500,
        signedFileKey: FILE_KEY,
        note: "Signed at the gallery",
      },
    });
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Agreement with Ivo Marren added"),
    );
  });

  it("refuses a file that is not a PDF, JPEG or PNG without uploading it", async () => {
    const dialog = await openAdd();
    const file = new File(["<html>"], "agreement.html", { type: "text/html" });
    fireEvent.change(dialog.getByLabelText(/Upload the signed agreement/), {
      target: { files: [file] },
    });
    expect(requestAgreementFileUpload).not.toHaveBeenCalled();
  });
});

describe("replacing and retiring", () => {
  it("starts the next version from the current terms and keeps the file unless changed", async () => {
    replaceConsignorAgreement.mockResolvedValue({ ok: true, data: agreement({ version: 2 }) });
    show([agreement({ note: "First terms" })]);
    fireEvent.click(screen.getByRole("button", { name: "Replace…" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Replace agreement, version 1" }),
    );
    expect(dialog.getByText("The signed file of version 1")).toBeInTheDocument();
    expect(dialog.getByRole("checkbox", { name: "LAX Bid" })).toBeChecked();
    fireEvent.click(dialog.getByRole("checkbox", { name: "lax.art" }));
    fireEvent.click(dialog.getByRole("button", { name: "Save new version" }));
    await waitFor(() => expect(replaceConsignorAgreement).toHaveBeenCalledOnce());
    expect(replaceConsignorAgreement.mock.calls[0]?.[0]).toMatchObject({
      partyId: PARTY,
      agreementId: agreement().agreementId,
      expectedVersion: 1,
      terms: {
        places: ["lax_bid"],
        lowestPricePence: 200_000,
        commissionBasisPoints: 2500,
        signedFileKey: FILE_KEY,
        note: "First terms",
      },
    });
    expect(requestAgreementFileUpload).not.toHaveBeenCalled();
  });

  it("says someone else changed the agreement, with Reload", async () => {
    replaceConsignorAgreement.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "This agreement was changed by someone else since it was opened",
      currentVersion: "2",
    });
    show([agreement()]);
    fireEvent.click(screen.getByRole("button", { name: "Replace…" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Replace agreement, version 1" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save new version" }));
    expect(await dialog.findByText("Someone else changed this agreement")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a field the API refused beside it and in the summary", async () => {
    replaceConsignorAgreement.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "Upload a PDF, JPEG or PNG file.",
      issues: [{ field: "signedFileKey", message: "Upload a PDF, JPEG or PNG file." }],
    });
    show([agreement()]);
    fireEvent.click(screen.getByRole("button", { name: "Replace…" }));
    const dialog = within(
      await screen.findByRole("dialog", { name: "Replace agreement, version 1" }),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Save new version" }));
    expect(
      await dialog.findByText("Signed agreement: Upload a PDF, JPEG or PNG file."),
    ).toBeInTheDocument();
  });

  it("asks before retiring, then retires at the version shown", async () => {
    retireConsignorAgreement.mockResolvedValue({
      ok: true,
      data: agreement({ status: "retired" }),
    });
    show([agreement()]);
    fireEvent.click(screen.getByRole("button", { name: "Retire…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Retire this agreement?" }));
    expect(
      dialog.getByText(/no longer covers LAX Bid and lax.art for Ivo Marren/),
    ).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Retire agreement" }));
    await waitFor(() =>
      expect(retireConsignorAgreement).toHaveBeenCalledWith(
        expect.objectContaining({ partyId: PARTY, expectedVersion: 1 }),
      ),
    );
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith("Agreement with Ivo Marren retired"),
    );
  });

  it("asks a keeper to sign in again before a change, keeping the dialog", async () => {
    retireConsignorAgreement.mockResolvedValue({
      ok: false,
      kind: "step_up_required",
      message: "Sign in again",
    });
    show([agreement()]);
    fireEvent.click(screen.getByRole("button", { name: "Retire…" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Retire this agreement?" }));
    fireEvent.click(dialog.getByRole("button", { name: "Retire agreement" }));
    expect(await screen.findByText(/Confirm it.s you/)).toBeInTheDocument();
  });
});
