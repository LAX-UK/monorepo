import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";

type DashboardFetchWarningBannerProps = {
  title: string;
  message: string;
};

/** Non-blocking warning when secondary layout data failed to load. */
export function DashboardFetchWarningBanner({ title, message }: DashboardFetchWarningBannerProps) {
  return (
    <Alert
      variant="default"
      className="border-outline-variant/40 bg-surface-container-low"
      role="alert"
      aria-live="polite"
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
