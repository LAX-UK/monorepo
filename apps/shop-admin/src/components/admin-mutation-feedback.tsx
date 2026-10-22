import Link from "next/link";

/** Persistent inline failure message; a step-up result also offers the way back in. */
export function AdminMutationFeedback({
  message,
  stepUpRequired,
  stepUpHref,
}: {
  message: string | null;
  stepUpRequired: boolean;
  stepUpHref: string;
}) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-error">
      {message}
      {stepUpRequired ? (
        <>
          {" "}
          <Link href={stepUpHref} className="font-medium underline underline-offset-2">
            Sign in again
          </Link>
        </>
      ) : null}
    </p>
  );
}
