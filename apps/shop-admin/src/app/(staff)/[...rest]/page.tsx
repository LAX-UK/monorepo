import { notFound } from "next/navigation";

/** Any URL no page matches: the staff not-found page, inside the shell, with a 404. */
export default function UnknownStaffPage(): never {
  notFound();
}
