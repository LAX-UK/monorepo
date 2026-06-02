import type {
  AbsenteeBidFormValues,
  OnsiteParticipationContext,
  TelephoneBidFormValues,
} from "./participation-request-input";

export type AbsenteeParticipationPayload = AbsenteeBidFormValues &
  OnsiteParticipationContext & { kind: "absentee" };
export type TelephoneParticipationPayload = TelephoneBidFormValues &
  OnsiteParticipationContext & { kind: "telephone" };

export type ParticipationRequestPayload =
  | AbsenteeParticipationPayload
  | TelephoneParticipationPayload;

export type ParticipationRequestDispatcher = {
  dispatch(input: ParticipationRequestPayload): Promise<void>;
};

/** Default transport: logs until CRM/email is wired. */
export const consoleParticipationRequestDispatcher: ParticipationRequestDispatcher = {
  async dispatch(input) {
    console.info("[onsite-participation]", input.kind, input.lotTitle, input.email);
  },
};
