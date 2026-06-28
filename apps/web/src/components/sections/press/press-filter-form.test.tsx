import { PressFilterForm } from "@/components/sections/press/press-filter-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("PressFilterForm", () => {
  beforeEach(() => {
    push.mockClear();
  });

  it("renders coverage type select alongside search and year", () => {
    render(
      <PressFilterForm
        initialParams={{ q: "", year: null, mentionType: null, page: 1 }}
        years={[2026, 2025]}
      />,
    );

    expect(screen.getByLabelText("Coverage type")).toBeTruthy();
    expect(screen.getByLabelText("Year")).toBeTruthy();
    expect(screen.getByLabelText("Search")).toBeTruthy();
  });

  it("navigates with mention type on submit", async () => {
    render(
      <PressFilterForm
        initialParams={{ q: "BBC", year: 2025, mentionType: "interview", page: 1 }}
        years={[2026, 2025]}
      />,
    );

    const form = screen.getByRole("button", { name: "Apply" }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("?q=BBC&year=2025&mentionType=interview");
    });
  });

  it("omits mentionType from query when all types selected", async () => {
    render(
      <PressFilterForm
        initialParams={{ q: "BBC", year: 2025, mentionType: null, page: 1 }}
        years={[2026, 2025]}
      />,
    );

    const form = screen.getByRole("button", { name: "Apply" }).closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form as HTMLFormElement);
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("?q=BBC&year=2025");
    });
  });
});
