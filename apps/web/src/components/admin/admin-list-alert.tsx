import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import type { ReactNode } from "react";

type Props = {
  title?: string;
  children: ReactNode;
  className?: string;
};

/** Destructive list-page alert with role="alert". */
export function AdminListAlert({ title = "Something went wrong", children, className }: Props) {
  return (
    <Alert variant="destructive" className={className} role="alert">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
