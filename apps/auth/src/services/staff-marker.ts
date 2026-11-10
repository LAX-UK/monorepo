import type { SocialSubjectPorts } from "@auction/auth";

/**
 * Whether the person holds a staff marker: one read, and nothing else about them. A failure is
 * thrown to the caller, which decides what to do without the answer.
 */
export async function hasStaffMarker(
  ports: Pick<SocialSubjectPorts, "twoFactorPolicyStore">,
  subjectId: string,
): Promise<boolean> {
  const { markers } = await ports.twoFactorPolicyStore.readSubjectPolicyInputs(subjectId);
  return markers.some((marker) => marker.kind === "staff");
}
