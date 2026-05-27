import { RhfDateTimePicker } from "@/components/ui/rhf-date-time-picker";
import { FormField, FormItem } from "@auction/ui/components/form";
import { render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

describe("RhfDateTimePicker", () => {
  it("forwards aria-invalid to the trigger when field has an error", async () => {
    function WithError() {
      const form = useForm({ defaultValues: { startsAt: "" } });
      useEffect(() => {
        form.setError("startsAt", { type: "manual", message: "Required" });
      }, [form]);

      return (
        <FormProvider {...form}>
          <FormField
            control={form.control}
            name="startsAt"
            render={({ field }) => (
              <FormItem>
                <RhfDateTimePicker value={field.value} onChange={field.onChange} />
              </FormItem>
            )}
          />
        </FormProvider>
      );
    }

    render(<WithError />);
    await waitFor(() => {
      const triggers = screen.getAllByRole("button", { name: /pick date and time/i });
      expect(triggers[0]).toHaveAttribute("aria-invalid", "true");
    });
  });
});
