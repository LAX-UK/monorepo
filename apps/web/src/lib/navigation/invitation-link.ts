import { CLIENT_ROUTES } from "./client-routes";

/** The page for an organisation invitation link: what it is, and "Accept invitation". */
export function invitationLinkPath(token: string): string {
  return `${CLIENT_ROUTES.invitations}/accept/${encodeURIComponent(token)}`;
}

/** Where that page's "Accept invitation" posts. */
export function invitationAcceptAction(token: string): string {
  return `${invitationLinkPath(token)}/confirm`;
}
