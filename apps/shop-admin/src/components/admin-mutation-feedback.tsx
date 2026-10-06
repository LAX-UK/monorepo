import Link from "next/link";

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
    <p className="text-sm text-neutral-600">
      {message}
      {stepUpRequired ? (
        <>
          {" "}
          <Link href={stepUpHref} className="underline">
            Sign in again with step-up
          </Link>
        </>
      ) : null}
    </p>
  );
}

export const adminFormFieldClass = "mt-1 w-full rounded border px-2 py-1 text-sm";
export const adminFormLabelClass = "block text-sm";
export const adminFormSectionClass = "space-y-3 rounded border p-3";
