"use client";

import { UnderlineInput } from "@/components/ui/input";
import { useDisableTwoFactorController } from "@/lib/auth/hooks/use-disable-two-factor-controller";
import { Button as UiButton } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@auction/ui/components/form";
import { useEffect } from "react";

type TwoFactorDisableDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisabled?: () => void;
};

export function TwoFactorDisableDialog({
  open,
  onOpenChange,
  onDisabled,
}: TwoFactorDisableDialogProps) {
  const { busy, form, submit } = useDisableTwoFactorController(() => {
    onOpenChange(false);
    onDisabled?.();
  });

  useEffect(() => {
    if (open) {
      form.reset({ password: "" });
      form.clearErrors();
    }
  }, [open, form]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Turn off two-factor authentication?</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 font-body text-sm text-on-surface-variant">
              <p>You will no longer be asked for a code when you sign in.</p>
              <p>Any unused backup codes will stop working.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4" onSubmit={submit} noValidate>
            {form.formState.errors.root ? (
              <p role="alert" className="text-sm text-error">
                {form.formState.errors.root.message}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm with your password</FormLabel>
                  <FormControl>
                    <UnderlineInput
                      type="password"
                      autoComplete="current-password"
                      className="w-full border-b-2 border-outline-variant/40 py-3"
                      {...field}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <UiButton
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </UiButton>
              <UiButton type="submit" variant="destructive" disabled={busy}>
                {busy ? "Disabling…" : "Turn off 2FA"}
              </UiButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
