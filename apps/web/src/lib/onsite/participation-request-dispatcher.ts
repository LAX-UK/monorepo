import type {
  AbsenteeBidFormValues,
  OnsiteParticipationContext,
} from "./participation-request-input";

export type AbsenteeParticipationPayload = AbsenteeBidFormValues &
  OnsiteParticipationContext & { kind: "absentee" };

export type ParticipationRequestPayload = AbsenteeParticipationPayload;

export interface ParticipationRequestDispatcher {
  dispatch(payload: ParticipationRequestPayload): Promise<void>;
}

export const consoleParticipationRequestDispatcher: ParticipationRequestDispatcher = {
  async dispatch(payload) {
    console.info("[participation-request]", payload.kind, {
      saleTitle: payload.saleTitle,
      lotNumber: payload.lotNumber,
      lotTitle: payload.lotTitle,
    });
  },
};
