/** Human-readable signup persona for admin user lists. */
export function formatSignupPersona(persona: string | null): string {
  if (!persona) return "Not set";
  if (persona === "organisation") return "Organisation";
  return persona.charAt(0).toUpperCase() + persona.slice(1);
}
