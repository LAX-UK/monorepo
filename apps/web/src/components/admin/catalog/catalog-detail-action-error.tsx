import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type Props = {
  error?: string | null | undefined;
  title?: string;
  className?: string;
};

export function CatalogDetailActionError({
  error,
  title = "Action failed",
  className = "mb-6",
}: Props) {
  const message = error ? safeDecodeAdminErrorParam(error) : null;
  if (!message) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
