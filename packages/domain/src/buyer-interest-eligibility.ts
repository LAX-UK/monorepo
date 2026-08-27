export type BuyerInterestSignupPersona = "individual" | "organisation" | null;

export function isBuyerInterestPersonaEligible(signupPersona: BuyerInterestSignupPersona): boolean {
  return signupPersona !== "organisation";
}

export function reconcileBuyerInterestSelection(input: {
  selectedIds: readonly string[];
  availableCatalogIds: readonly string[];
}): {
  selectedAvailableIds: string[];
  selectedUnavailableIds: string[];
} {
  const available = new Set(input.availableCatalogIds);
  return {
    selectedAvailableIds: input.selectedIds.filter((id) => available.has(id)),
    selectedUnavailableIds: input.selectedIds.filter((id) => !available.has(id)),
  };
}
