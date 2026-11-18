// @vitest-environment jsdom
import { laxStaffAccess } from "@/server/domain/lax-staff-access";
import type {
  AdminArtworkConsignor,
  AdminArtworkConsignorAgreement,
  AdminConsignorChange,
} from "@auction/shop-contracts";
import { StaffAccessProvider, StaffTooltipProvider } from "@auction/staff-ui";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setArtworkConsignor = vi.fn();
const refresh = vi.fn();
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("@/server/application/admin-artwork-consignor-actions.server", () => ({
  setArtworkConsignor,
}));
// The picker searches shop-api; here it offers one client to choose.
vi.mock("@/components/pickers/record-pickers.client", () => ({
  PartyPicker: ({ onChange }: { onChange: (option: { id: string; label: string }) => void }) => (
    <button type="button" onClick={() => onChange({ id: OTHER, label: "Ana Ruiz" })}>
      Pick Ana Ruiz
    </button>
  ),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh }),
  usePathname: () => "/from-zoho/r",
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: toastSuccess, error: vi.fn(), warning: vi.fn() }),
  Toaster: () => null,
}));

const { installLayoutStubs } = await import("@/test/radix-stubs");
installLayoutStubs();
const { ConsignorSection } = await import("./consignor-section.client");

const REGISTER = "44444444-4444-4444-8444-444444444444";
const PARTY = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const TODAY = "2026-11-17";
const KEEPER = ["artwork_register.read", "consignor_agreement.read", "consignor_agreement.manage"];
const READER = ["artwork_register.read", "consignor_agreement.read"];

function change(patch: Partial<AdminConsignorChange> = {}): AdminConsignorChange {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    consignor: { kind: "client", partyId: PARTY, displayName: "Ivo Marren" },
    changeReason: null,
    setAt: "2026-11-10T10:00:00.000Z",
    setByName: "Sam Staff",
    ...patch,
  };
}

function agreement(
  patch: Partial<AdminArtworkConsignorAgreement> = {},
): AdminArtworkConsignorAgreement {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    places: ["lax_bid", "lax_art"],
    startsOn: "2026-03-03",
    endsOn: "2027-03-02",
    status: "current",
    createdAt: "2026-03-03T10:00:00.000Z",
    ...patch,
  };
}

function view(patch: Partial<AdminArtworkConsignor> = {}): AdminArtworkConsignor {
  const current = "current" in patch ? (patch.current ?? null) : change();
  return {
    registerId: REGISTER,
    current,
    history: current ? [current] : [],
    moreHistory: false,
    agreements: [],
    ...patch,
  };
}

type State = Parameters<typeof ConsignorSection>[0]["state"];

function show(state: State, capabilities = KEEPER) {
  return render(
    <StaffTooltipProvider>
      <StaffAccessProvider access={laxStaffAccess(capabilities, "Administrator")}>
        <ConsignorSection
          registerId={REGISTER}
          title="Harbour at dusk"
          state={state}
          today={TODAY}
        />
      </StaffAccessProvider>
    </StaffTooltipProvider>,
  );
}

const loaded = (consignor: AdminArtworkConsignor): State => ({ kind: "loaded", consignor });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the Consignor section", () => {
  it("names the client consignor, links their agreements and shows the one in force", () => {
    show(loaded(view({ agreements: [agreement()] })));
    expect(screen.getByRole("link", { name: "Ivo Marren" })).toHaveAttribute(
      "href",
      `/clients/${PARTY}#agreements`,
    );
    expect(screen.getByText("In force")).toBeInTheDocument();
    expect(screen.getByText("LAX Bid and lax.art")).toBeInTheDocument();
    expect(screen.getByText(/to .*2 Mar 2027/)).toBeInTheDocument();
    expect(screen.getByText(/by Sam Staff/)).toBeInTheDocument();
    expect(screen.getByText("Set to Ivo Marren")).toBeInTheDocument();
  });

  it("warns when the client has no current agreement, and points to their page", () => {
    show(loaded(view()));
    expect(screen.getByText("No agreement")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add one on the client's page" })).toHaveAttribute(
      "href",
      `/clients/${PARTY}#agreements`,
    );
  });

  it("reads an expired agreement as expired, not in force", () => {
    show(loaded(view({ agreements: [agreement({ endsOn: "2026-06-30" })] })));
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("needs no agreement line when LAX owns the work, and shows the reason in the history", () => {
    const lax = change({
      id: "77777777-7777-4777-8777-777777777777",
      consignor: { kind: "lax" },
      changeReason: "Bought outright",
      setByName: null,
    });
    show(loaded(view({ current: lax, history: [lax, change()] })));
    expect(screen.getAllByText("LAX owns this work").length).toBeGreaterThan(0);
    expect(screen.queryByText("Agreement")).toBeNull();
    expect(screen.getByText("Changed to LAX owns this work")).toBeInTheDocument();
    expect(screen.getByText("Bought outright")).toBeInTheDocument();
    expect(screen.getAllByText(/LAX staff/).length).toBeGreaterThan(0);
  });

  it("says no consignor is set yet, and offers Set consignor to keepers only", () => {
    show(loaded(view({ current: null })));
    expect(screen.getByText("Consignor not set")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set consignor…" })).toBeInTheDocument();
  });

  it("lets readers see the consignor without changing it", () => {
    show(loaded(view()), READER);
    expect(screen.getByRole("link", { name: "Ivo Marren" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change consignor…" })).toBeNull();
  });

  it("is the #consignor anchor that a Set consignor link opens the record at", () => {
    const { container } = show(loaded(view()));
    expect(container.querySelector("section#consignor")).toHaveAccessibleName("Consignor");
    cleanup();
    const failed = show({ kind: "failed" });
    expect(failed.container.querySelector("section#consignor")).not.toBeNull();
  });

  it("says the consignor did not load, with Try again", () => {
    show({ kind: "failed" });
    expect(screen.getByText("The consignor did not load")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("setting the consignor", () => {
  async function open(state: State, button: string, title: string) {
    show(state);
    fireEvent.click(screen.getByRole("button", { name: button }));
    return within(await screen.findByRole("dialog", { name: title }));
  }

  it("shows one problem beside its field only, without a summary", async () => {
    const dialog = await open(loaded(view({ current: null })), "Set consignor…", "Set consignor");
    fireEvent.click(dialog.getByRole("button", { name: "Set consignor" }));
    expect(await dialog.findByText("Choose who consigned this work.")).toBeInTheDocument();
    expect(dialog.queryByText("There is a problem")).toBeNull();
    expect(setArtworkConsignor).not.toHaveBeenCalled();
  });

  it("sets a client the first time without a reason", async () => {
    setArtworkConsignor.mockResolvedValue({ ok: true, data: view() });
    const dialog = await open(loaded(view({ current: null })), "Set consignor…", "Set consignor");
    expect(dialog.queryByLabelText("Reason for the change")).toBeNull();
    fireEvent.click(dialog.getByRole("radio", { name: /A client/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Pick Ana Ruiz" }));
    fireEvent.click(dialog.getByRole("button", { name: "Set consignor" }));
    await waitFor(() =>
      expect(setArtworkConsignor).toHaveBeenCalledWith({
        registerId: REGISTER,
        body: {
          consignor: { kind: "client", partyId: OTHER },
          reason: null,
          expectedCurrentId: null,
        },
        idempotencyKey: expect.any(String),
      }),
    );
    expect(toastSuccess).toHaveBeenCalledWith("Consignor of Harbour at dusk set to Ana Ruiz");
  });

  it("lists two problems at the top and beside each field when changing", async () => {
    const dialog = await open(loaded(view()), "Change consignor…", "Change consignor");
    fireEvent.click(dialog.getByRole("button", { name: "Change consignor" }));
    expect(await dialog.findByText("There is a problem")).toBeInTheDocument();
    expect(dialog.getByText("Consignor: This is the consignor already.")).toBeInTheDocument();
    expect(
      dialog.getByText("Reason for the change: Say why the consignor is changing."),
    ).toBeInTheDocument();
    expect(setArtworkConsignor).not.toHaveBeenCalled();
  });

  it("changes to LAX with a reason, against the change the page read", async () => {
    setArtworkConsignor.mockResolvedValue({ ok: true, data: view() });
    const dialog = await open(loaded(view()), "Change consignor…", "Change consignor");
    fireEvent.click(dialog.getByRole("radio", { name: /LAX owns this work/ }));
    fireEvent.change(dialog.getByLabelText("Reason for the change"), {
      target: { value: "Bought outright" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Change consignor" }));
    await waitFor(() =>
      expect(setArtworkConsignor).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            consignor: { kind: "lax" },
            reason: "Bought outright",
            expectedCurrentId: change().id,
          },
        }),
      ),
    );
  });

  it("offers Reload when someone else changed the consignor meanwhile", async () => {
    setArtworkConsignor.mockResolvedValue({
      ok: false,
      kind: "conflict",
      message: "The consignor was changed by someone else since it was opened",
      currentVersion: "88888888-8888-4888-8888-888888888888",
    });
    const dialog = await open(loaded(view()), "Change consignor…", "Change consignor");
    fireEvent.click(dialog.getByRole("radio", { name: /LAX owns this work/ }));
    fireEvent.change(dialog.getByLabelText("Reason for the change"), {
      target: { value: "Bought outright" },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Change consignor" }));
    expect(await dialog.findByText("Someone else changed the consignor")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Reload" }));
    expect(refresh).toHaveBeenCalled();
  });

  it("shows the field shop-api names beside it", async () => {
    setArtworkConsignor.mockResolvedValue({
      ok: false,
      kind: "validation",
      message: "Choose a client from the list.",
      issues: [{ field: "client", message: "Choose a client from the list." }],
    });
    const dialog = await open(loaded(view({ current: null })), "Set consignor…", "Set consignor");
    fireEvent.click(dialog.getByRole("radio", { name: /A client/ }));
    fireEvent.click(dialog.getByRole("button", { name: "Pick Ana Ruiz" }));
    fireEvent.click(dialog.getByRole("button", { name: "Set consignor" }));
    expect(await dialog.findByText("Choose a client from the list.")).toBeInTheDocument();
  });
});
