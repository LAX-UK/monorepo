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
    <button
      type="submit"
      disabled={disabled ?? loading}
      className={`flex h-[60px] w-full cursor-pointer items-center justify-center rounded bg-brand-900 px-8 font-headline text-base font-semibold leading-6 tracking-wide text-[#F1F1F3] transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    >
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}
