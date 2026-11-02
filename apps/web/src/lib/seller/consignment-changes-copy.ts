/** What the consignment page says while the specialist waits on the seller for changes. */
export type ChangesRequestedCopy = { lead: string };

/**
 * The words under "Your specialist asked for changes", for the person reading. Someone who may
 * edit is told what to do; everyone else is told who is doing it, since they cannot.
 */
export function changesRequestedCopy(input: {
  canEdit: boolean;
  /** The member who sent the work, when known. */
  sentBy: string | null;
}): ChangesRequestedCopy {
  if (input.canEdit) {
    return { lead: "Make the changes, then send it back. It keeps its place and its history." };
  }
  const maker = input.sentBy ?? "A colleague";
  return { lead: `${maker} is making the changes the specialist asked for.` };
}
