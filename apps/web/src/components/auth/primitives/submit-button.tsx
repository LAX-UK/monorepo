import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
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
    <Button
      type="submit"
      variant="cta"
      size="xl"
      disabled={disabled ?? loading}
      className={cn("font-headline shadow-none", className)}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : children}
    </Button>
  );
}
