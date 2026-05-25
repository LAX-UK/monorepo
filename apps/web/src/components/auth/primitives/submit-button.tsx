import { cn } from "@auction/ui";
import { AsyncButton } from "@auction/ui/components/loading-button";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type AuthSubmitButtonProps = {
  children: ReactNode;
  loading?: boolean;
  loadingLabel?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type">;

export function AuthSubmitButton({
  children,
  loading = false,
  loadingLabel,
  disabled,
  className = "",
  ...rest
}: AuthSubmitButtonProps) {
  return (
    <AsyncButton
      type="submit"
      variant="cta"
      size="xl"
      loading={loading}
      {...(loadingLabel !== undefined && typeof loadingLabel === "string" ? { loadingLabel } : {})}
      disabled={disabled}
      className={cn("font-headline shadow-none", className)}
      {...rest}
    >
      {children}
    </AsyncButton>
  );
}
