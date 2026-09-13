/** Allowed recovery transitions for staging Identity cutover. */
export const RECOVERY_TRANSITIONS = {
  deploy_candidate: ["acceptance_disabled"],
  acceptance_disabled: ["enable_ssf"],
  enable_ssf: ["acceptance_enabled"],
  acceptance_enabled: ["rollback_rehearsal", "record_accepted_release"],
  rollback_rehearsal: ["restore_candidate"],
  restore_candidate: ["acceptance_after_rehearsal"],
  acceptance_after_rehearsal: ["record_accepted_release"],
};

export function assertTransition(from, to) {
  const allowed = RECOVERY_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Recovery transition ${from} -> ${to} is not allowed`);
  }
}

export function restorationRequired(transitions) {
  return transitions.includes("rollback_rehearsal");
}
