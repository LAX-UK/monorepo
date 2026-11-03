/** One routing row: a department's specialist, or the fallback when `departmentSlug` is null. */
export type EnquiryRoutingRule = {
  departmentSlug: string | null;
  assignedToUserId: string;
};

/**
 * Who receives an enquiry on arrival: the department's rule, else the fallback, else nobody.
 * One policy for every intake, so routing cannot differ between the contact form and the
 * enquiry page.
 */
export function resolveEnquiryAssignee(
  rules: readonly EnquiryRoutingRule[],
  departmentSlug: string | null,
): string | null {
  const byDepartment = departmentSlug
    ? rules.find((rule) => rule.departmentSlug === departmentSlug)
    : undefined;
  const fallback = rules.find((rule) => rule.departmentSlug === null);
  return (byDepartment ?? fallback)?.assignedToUserId ?? null;
}

export type EnquiryRoutingChange = {
  departmentSlug: string | null;
  assignedToUserId: string | null;
  previousAssignedToUserId: string | null;
};

/** What a new routing table changes: rules added or reassigned, and rules removed. */
export function diffEnquiryRouting(
  previous: readonly EnquiryRoutingRule[],
  next: readonly EnquiryRoutingRule[],
): EnquiryRoutingChange[] {
  const before = new Map(previous.map((rule) => [rule.departmentSlug, rule.assignedToUserId]));
  const after = new Map(next.map((rule) => [rule.departmentSlug, rule.assignedToUserId]));
  const changes: EnquiryRoutingChange[] = [];
  for (const [departmentSlug, assignedToUserId] of after) {
    const previousAssignedToUserId = before.get(departmentSlug) ?? null;
    if (previousAssignedToUserId !== assignedToUserId) {
      changes.push({ departmentSlug, assignedToUserId, previousAssignedToUserId });
    }
  }
  for (const [departmentSlug, previousAssignedToUserId] of before) {
    if (!after.has(departmentSlug)) {
      changes.push({ departmentSlug, assignedToUserId: null, previousAssignedToUserId });
    }
  }
  return changes;
}
