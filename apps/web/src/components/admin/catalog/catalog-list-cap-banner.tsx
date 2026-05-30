import { Alert, AlertDescription } from "@auction/ui/components/alert";

type Props = {
  message: string;
};

/** Inline notice when a list view hits a server-side row cap (e.g. pipeline mode). */
export function CatalogListCapBanner({ message }: Props) {
  return (
    <Alert variant="default" className="border-outline-variant/40 bg-surface-container-low">
      <AlertDescription className="font-body text-sm text-on-surface-variant">
        {message}
      </AlertDescription>
    </Alert>
  );
}
