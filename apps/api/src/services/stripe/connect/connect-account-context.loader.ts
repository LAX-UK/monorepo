import type { ILegalEntityConnectReader } from "../../../repositories/interfaces/legal-entity-connect.reader.js";
import type { ConnectAccountCreationContextRow } from "../../../repositories/legal-entity-connect.types.js";
import { throwConnectError } from "./connect-service-errors.js";

export type ConnectAccountCreationContext = ConnectAccountCreationContextRow;

export async function loadConnectAccountCreationContext(
  reader: ILegalEntityConnectReader,
  legalEntityId: string,
): Promise<ConnectAccountCreationContext> {
  const context = await reader.loadAccountCreationContext(legalEntityId);
  if (!context) throwConnectError("legal_entity_not_found", 404);
  return context;
}
