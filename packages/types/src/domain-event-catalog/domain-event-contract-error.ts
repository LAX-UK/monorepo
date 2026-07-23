/** Terminal delivery / publish failure when a domain event violates the frozen catalog. */
export class DomainEventContractError extends Error {
  readonly code = "domain_event_contract_invalid" as const;

  constructor(
    readonly eventType: string,
    readonly detail: string,
  ) {
    super(`domain_event_contract_invalid:${eventType}:${detail}`);
    this.name = "DomainEventContractError";
  }
}
