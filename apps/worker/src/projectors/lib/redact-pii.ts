/** projector-side entry for domain event PII minimisation.
 * Implementation lives in `@auction/types` so the API audit export shares the same policy.
 */
export {
  redactDomainEventPayload,
  type RedactDomainEventPayloadOptions,
} from "@auction/types";
