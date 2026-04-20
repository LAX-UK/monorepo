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
      variant="ghost"
      disabled={disabled ?? loading}
      className={cn(
        "flex h-[60px] w-full cursor-pointer items-center justify-center rounded bg-brand-900 px-8 font-headline text-base font-semibold leading-6 tracking-wide text-[#F1F1F3] shadow-none transition-opacity hover:bg-brand-900 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : children}
    </Button>
  );
}
