"use client";

import { SettingsField } from "@/components/dashboard/settings-field";
import { UnderlineInput } from "@/components/ui/input";
import { useProfileNameController } from "@/lib/forms/profile/use-profile-name-controller";
import { Button } from "@auction/ui/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";

export function PersonalNameBlock({ initialName }: { initialName: string }) {
  const { form, onSubmit, isSubmitting } = useProfileNameController(initialName);

  return (
    <SettingsField
      label="Name"
      value={
        <Form {...form}>
          <form id="profile-name-form" onSubmit={onSubmit} className="w-full max-w-lg space-y-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Display name</FormLabel>
                  <FormControl>
                    <UnderlineInput
                      {...field}
                      className="w-full border-b border-outline-variant/50 py-2 font-body text-base font-normal text-on-surface"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="secondaryOutline"
              disabled={isSubmitting}
              className="min-w-28"
            >
              {isSubmitting ? "Saving…" : "Save name"}
            </Button>
          </form>
        </Form>
      }
    />
  );
}
