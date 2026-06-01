import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
  variant?: "destructive" | "default";
};

/** List/detail alert with role="alert". */
export function AdminListAlert({
  title = "Something went wrong",
  children,
  className,
  variant = "destructive",
}: Props) {
  return (
    <Alert variant={variant} className={className} role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
