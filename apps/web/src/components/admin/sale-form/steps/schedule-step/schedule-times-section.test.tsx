import { emptyAdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-defaults";
import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import { ATG_TIME_ZONE_LOCKED_NOTE } from "@auction/types";
import { SALE_TIME_ZONE_LOCKED_MESSAGE } from "@auction/validators";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ScheduleTimesSection } from "./schedule-times-section";

let form: UseFormReturn<AdminSaleFormValues>;

function Harness({
  isDraft = true,
  timeZoneLocked = false,
  timeZoneFixedByAtg = false,
  isSaleroom = false,
  defaults = {},
}: {
  isDraft?: boolean;
  timeZoneLocked?: boolean;
  timeZoneFixedByAtg?: boolean;
  isSaleroom?: boolean;
  defaults?: Partial<AdminSaleFormValues>;
}) {
  form = useForm<AdminSaleFormValues>({
    defaultValues: { ...emptyAdminSaleFormValues(), ...defaults },
  });
  return (
    <ScheduleTimesSection
      form={form}
      isDraft={isDraft}
      timeZoneLocked={timeZoneLocked}
      timeZoneFixedByAtg={timeZoneFixedByAtg}
      isSaleroom={isSaleroom}
    />
  );
}

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("ScheduleTimesSection time zone", () => {
  it("shows the zone as a city list and labels the times in it", () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: /time zone/i })).toHaveTextContent(
      "London (GMT/BST)",
    );
    // The zone is stated once, in one line; the inputs carry no zone name of their own.
    expect(screen.getAllByText(/Times are in London time \(GMT\/BST\)/)).toHaveLength(1);
    expect(screen.queryByText(/Europe\/London \((GMT|BST)\)/)).not.toBeInTheDocument();
  });

  it("searches by city and keeps the typed times when the zone changes", async () => {
    render(<Harness defaults={{ startTime: "2030-11-12T18:00", endTime: "2030-11-19T18:00" }} />);
    fireEvent.click(screen.getByRole("combobox", { name: /time zone/i }));
    fireEvent.change(screen.getByPlaceholderText("Search by city or zone"), {
      target: { value: "paris" },
    });
    fireEvent.click(await screen.findByText("Paris (CET/CEST)"));
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

  it("is locked once the sale is announced, read-only with the reason shown", () => {
    render(<Harness isDraft={false} />);
    expect(screen.queryByRole("combobox", { name: /time zone/i })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /time zone/i })).toHaveTextContent("London");
    expect(
      screen.getByText(new RegExp(SALE_TIME_ZONE_LOCKED_MESSAGE.slice(0, 40))),
    ).toBeInTheDocument();
    expect(SALE_TIME_ZONE_LOCKED_MESSAGE).toContain("announced");
  });

  it("stays locked for a draft that was announced once and unpublished", () => {
    render(<Harness isDraft timeZoneLocked />);
    expect(screen.queryByRole("combobox", { name: /time zone/i })).not.toBeInTheDocument();
  });

  it("locks a draft that ATG holds, and says why instead of the announced-sale reason", () => {
    render(<Harness isDraft timeZoneFixedByAtg />);
    expect(screen.queryByRole("combobox", { name: /time zone/i })).not.toBeInTheDocument();
    expect(screen.getByText(new RegExp(ATG_TIME_ZONE_LOCKED_NOTE))).toBeInTheDocument();
    expect(screen.queryByText(/fixed once a sale is announced/)).not.toBeInTheDocument();
  });

  it("leads with the usual cities before anything is typed", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("combobox", { name: /time zone/i }));
    const options = await screen.findAllByRole("option");
    expect(options[0]).toHaveTextContent("London (GMT/BST)");
    expect(options[1]).toHaveTextContent("Paris");
    expect(options[2]).toHaveTextContent("New York");
  });

  it("does not repeat a zone it cannot use in the error state", async () => {
    render(<Harness defaults={{ timeZone: "UTC" }} />);
    expect(screen.queryByText(/Times are in/)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /time zone/i })).toHaveTextContent(/^UTC$/);
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

  it("keeps London once staff choose it, whatever the venue country does next", async () => {
    render(<Harness isSaleroom />);
    await act(async () => {
      form.setValue("locationCountry", "France");
    });
    await waitFor(() => expect(form.getValues("timeZone")).toBe("Europe/Paris"));
    await act(async () => {
      form.setValue("timeZone", "Europe/London");
    });
    await act(async () => {
      form.setValue("locationCountry", "Germany");
    });
    expect(form.getValues("timeZone")).toBe("Europe/London");
  });
});
