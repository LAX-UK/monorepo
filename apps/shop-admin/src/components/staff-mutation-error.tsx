import type { AdminMutation } from "@/components/use-admin-mutation";
import { CircleAlert } from "@auction/staff-ui/icons";

/**
 * A failed action, kept on screen where the person is working until the next attempt. An action
 * that needs a recent sign-in also offers the way back in. Errors that need a decision never go
 * in a toast.
 */
export function StaffMutationError({
  mutation,
}: {
  mutation: Pick<AdminMutation, "message" | "stepUpRequired" | "stepUpHref">;
}) {
  if (!mutation.message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-staff-lg bg-staff-danger-bg px-3 py-2.5 text-staff-sm text-staff-danger-fg"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {mutation.message}
        {mutation.stepUpRequired ? (
          <>
            {" "}
            <a href={mutation.stepUpHref} className="font-medium underline">
              Sign in again
            </a>
          </>
        ) : null}
      </span>
    </p>
  );
}
