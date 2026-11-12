import { answerSellerReofferAction } from "@/lib/actions/seller-reoffer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SellerReofferAnswer } from "./seller-reoffer-answer";

vi.mock("@/lib/actions/seller-reoffer", () => ({ answerSellerReofferAction: vi.fn() }));
const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("@/lib/ui/notify", () => ({ notify }));
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ID = "11111111-1111-4111-8111-111111111111";
const answer = vi.mocked(answerSellerReofferAction);

function open() {
  render(
    <SellerReofferAnswer
      reofferId={ID}
      lotTitle="The Winter Study"
      offer="£82,000.00"
      proceeds="£72,160.00"
    />,
  );
}

describe("SellerReofferAnswer", () => {
  beforeEach(() => {
    answer.mockReset();
    refresh.mockReset();
    notify.success.mockReset();
    notify.error.mockReset();
  });

  it("asks again with the price and the proceeds before agreeing, and sends nothing until they do", async () => {
    answer.mockResolvedValue({ ok: true, data: undefined });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    expect(
      await screen.findByText("Agree to offer The Winter Study to the next bidder at £82,000.00?"),
    ).toBeTruthy();
    expect(screen.getByText(/Estimated proceeds £72,160.00/)).toBeTruthy();
    expect(answer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Yes, agree" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith(ID, { answer: "given" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(notify.success).toHaveBeenCalledWith("Your agreement was sent");
  });

  it("does not agree when the sheet is cancelled", async () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(answer).not.toHaveBeenCalled();
  });

  it("says what is missing inline when Not this time has no choice, then sends the choice", async () => {
    answer.mockResolvedValue({ ok: true, data: undefined });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Not this time" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send my answer" }));
    expect(await screen.findByText("Choose what you'd like us to do.")).toBeTruthy();
    expect(answer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: /Return it to me/ }));
    expect(screen.queryByText("Choose what you'd like us to do.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Send my answer" }));
    await waitFor(() =>
      expect(answer).toHaveBeenCalledWith(ID, {
        answer: "refused",
        declinePreference: "return_to_me",
      }),
    );
  });

  it("keeps the sheet open with the reason when the answer does not go through", async () => {
    answer.mockResolvedValue({
      ok: false,
      error: "Something went wrong on our side. Nothing was changed. Try again in a moment.",
      status: 503,
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, agree" }));
    expect(await screen.findByText(/Nothing was changed/)).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reloads the page when the request closed or was answered meanwhile", async () => {
    answer.mockResolvedValue({
      ok: false,
      error: "This request has closed. Please contact us and we'll take it from there.",
      status: 409,
      errorCode: "consent_window_ended",
    });
    open();
    fireEvent.click(screen.getByRole("button", { name: "Agree" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yes, agree" }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("This request has closed"));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
