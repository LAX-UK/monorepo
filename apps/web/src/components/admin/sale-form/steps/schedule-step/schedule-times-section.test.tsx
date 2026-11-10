import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { SALE_TIME_ZONE_LOCKED_MESSAGE } from "@auction/validators";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ScheduleTimesSection } from "./schedule-times-section";

let form: UseFormReturn<AdminSaleFormValues>;

function Harness({
  isDraft = true,
  isSaleroom = false,
  defaults = {},
}: {
  isDraft?: boolean;
  isSaleroom?: boolean;
  defaults?: Partial<AdminSaleFormValues>;
}) {
  form = useForm<AdminSaleFormValues>({
    defaultValues: { ...emptyAdminSaleFormValues(), ...defaults },
  });
  return <ScheduleTimesSection form={form} isDraft={isDraft} isSaleroom={isSaleroom} />;
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("ScheduleTimesSection time zone", () => {
  it("shows the zone as a city list and labels the times in it", () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: /time zone/i })).toHaveTextContent("London");
    expect(screen.getByText(/Times are in London time \(GMT\/BST\)/)).toBeInTheDocument();
    expect(screen.getAllByText(/Europe\/London \((GMT|BST)\)/)).toHaveLength(3);
  });

  it("searches by city and keeps the typed times when the zone changes", async () => {
    render(<Harness defaults={{ startTime: "2030-11-12T18:00", endTime: "2030-11-19T18:00" }} />);
    fireEvent.click(screen.getByRole("combobox", { name: /time zone/i }));
    fireEvent.change(screen.getByPlaceholderText("Search by city or zone"), {
      target: { value: "paris" },
    });
    fireEvent.click(await screen.findByText("Europe/Paris"));
    await waitFor(() => expect(form.getValues("timeZone")).toBe("Europe/Paris"));
    expect(form.getValues("startTime")).toBe("2030-11-12T18:00");
    expect(screen.getByText(/Times are in Paris time \(CET\/CEST\)/)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("18:00").length).toBeGreaterThan(0);
  });

  it("explains an empty search", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox", { name: /time zone/i }));
    fireEvent.change(screen.getByPlaceholderText("Search by city or zone"), {
      target: { value: "1234567" },
    });
    expect(await screen.findByText("No time zone matches.")).toBeInTheDocument();
  });

  it("is locked once the sale is published, with the reason shown", () => {
    render(<Harness isDraft={false} />);
    expect(screen.getByRole("combobox", { name: /time zone/i })).toBeDisabled();
    expect(
      screen.getByText(new RegExp(SALE_TIME_ZONE_LOCKED_MESSAGE.slice(0, 40))),
    ).toBeInTheDocument();
  });

  it("shows the field's error", async () => {
    render(<Harness />);
    await act(async () => {
      form.setError("timeZone", {
        type: "custom",
        message: "Choose the city the sale runs in, not UTC or a fixed offset",
      });
    });
    expect(
      await screen.findByText("Choose the city the sale runs in, not UTC or a fixed offset"),
    ).toBeInTheDocument();
  });

  it("follows a venue country with a single zone until staff choose one", async () => {
    render(<Harness isSaleroom />);
    await act(async () => {
      form.setValue("locationCountry", "France");
    });
    await waitFor(() => expect(form.getValues("timeZone")).toBe("Europe/Paris"));
    await act(async () => {
      form.setValue("locationCountry", "United States");
    });
    expect(form.getValues("timeZone")).toBe("Europe/Paris");
  });
});
