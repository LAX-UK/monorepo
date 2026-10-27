import { notFound } from "next/navigation";

/**
 * Any admin URL no page matches: the admin not-found page, inside the staff shell, with a 404.
 * It sits outside the section loading boundaries so the status is decided before streaming.
 */
export default function UnknownAdminPage(): never {
  notFound();
}
