import type { ContactTopic } from "@auction/validators";

export type ContactPayload = {
  topic: ContactTopic;
  email: string;
  name: string;
  message: string;
  phone?: string | undefined;
  /** The page the form was sent from, as a path. */
  sourcePage?: string | undefined;
};

/** The enquiry did not reach the platform. The form shows its send-failed state. */
export class ContactDispatchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ContactDispatchError";
  }
}

export type ContactDispatcher = {
  /** Resolves once the enquiry is stored; throws {@link ContactDispatchError} when it is not. */
  dispatch(input: ContactPayload): Promise<void>;
};
