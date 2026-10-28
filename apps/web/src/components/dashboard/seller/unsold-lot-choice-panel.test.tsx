import { requestUnsoldChoiceAction } from "@/lib/actions/consignment-after-sale";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnsoldLotChoicePanel } from "./unsold-lot-choice-panel";

vi.mock("@/lib/actions/consignment-after-sale", () => ({ requestUnsoldChoiceAction: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const hint = "Leave it empty to keep the current reserve of £5,000.";

describe("UnsoldLotChoicePanel", () => {
  beforeEach(() => {
    vi.mocked(requestUnsoldChoiceAction).mockReset();
    refresh.mockReset();
  });

  it("sends a relist with a lower reserve to the specialist", async () => {
    vi.mocked(requestUnsoldChoiceAction).mockResolvedValue({ ok: true });
    render(<UnsoldLotChoicePanel submissionId="s1" view={{ mode: "choose", reserveHint: hint }} />);
    expect(screen.getByRole("heading", { name: "Choose what happens next" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Relist it/ }));
    fireEvent.change(screen.getByLabelText("Lower reserve (optional)"), {
      target: { value: "4000" },
    });
    expect(screen.getByText(hint)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Send to your specialist" }));
    await waitFor(() =>
      expect(requestUnsoldChoiceAction).toHaveBeenCalledWith("s1", {
        choice: "relist",
        reserve: "4000",
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("asks for a choice before sending, and shows a refusal", async () => {
    vi.mocked(requestUnsoldChoiceAction).mockResolvedValue({
      ok: false,
      error: "The reserve is lower than your specialist accepts for a relist.",
    });
    render(<UnsoldLotChoicePanel submissionId="s1" view={{ mode: "choose", reserveHint: hint }} />);
    fireEvent.click(screen.getByRole("button", { name: "Send to your specialist" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Choose what happens next.");
    fireEvent.click(screen.getByRole("radio", { name: /Have it returned/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send to your specialist" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("lower than your specialist"),
    );
    expect(requestUnsoldChoiceAction).toHaveBeenCalledWith("s1", {
      choice: "collect",
      reserve: null,
    });
  });

  it("tells a consignor who chooses, with no form", () => {
    render(
      <UnsoldLotChoicePanel
        submissionId="s1"
        view={{
          mode: "waiting_on_admin",
          message: "An owner or admin of Northbank Gallery chooses.",
        }}
      />,
    );
    expect(screen.getByText("An owner or admin of Northbank Gallery chooses.")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows a waiting request and lets an admin change it", () => {
    render(
      <UnsoldLotChoicePanel
        submissionId="s1"
        view={{
          mode: "requested",
          summary: "Relist it with a reserve of £4,000",
          canChange: true,
          reserveHint: hint,
          history: [{ label: "Asked: Relist it", by: "Jane Smith", on: "21 Oct 2026" }],
        }}
        current={{ choice: "relist", reserve: "4000" }}
      />,
    );
    expect(screen.getByText(/Waiting for your specialist to confirm/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change my choice" }));
    expect(
      (screen.getByRole("radio", { name: /Relist it/ }) as HTMLButtonElement).dataset.state,
    ).toBe("checked");
    expect((screen.getByLabelText("Lower reserve (optional)") as HTMLInputElement).value).toBe(
      "4000",
    );
  });

  it("shows the confirmed outcome with the specialist's note", () => {
    render(
      <UnsoldLotChoicePanel
        submissionId="s1"
        view={{
          mode: "confirmed",
          summary: "Sell it privately",
          adjusted: true,
          note: "A private buyer has asked about it.",
          history: [],
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "What happens next" })).toBeTruthy();
    expect(screen.getByText("A private buyer has asked about it.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
