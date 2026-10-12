import type { EditorialStatus } from "@/components/use-editorial-mutation";
import Link from "next/link";

export function EditorialStatusMessage({ status }: { status: EditorialStatus }) {
  if (!status) return null;
  const isError = status.tone === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={
        isError
          ? "rounded border border-error bg-error-container px-3 py-2 text-sm text-error"
          : "rounded border border-success bg-success-container px-3 py-2 text-sm text-success"
      }
    >
      {status.text}
      {status.stepUp ? (
        <>
          {" "}
          <Link href="/api/auth/login?returnTo=%2Feditorial" className="underline">
            Sign in again with step-up
          </Link>
        </>
      ) : null}
    </p>
  );
}

export function EditorialErrorList({ errors }: { errors: readonly string[] }) {
  if (errors.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded border border-error bg-error-container px-3 py-2 text-sm text-error"
    >
      <p className="font-medium">Fix these before saving:</p>
      <ul className="mt-1 list-disc pl-5">
        {[...new Set(errors)].map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
