export type ContactPayload = {
  topic: string;
  email: string;
  name: string;
  message: string;
};

export type ContactDispatcher = {
  dispatch(input: ContactPayload): Promise<void>;
};

/** Default transport: logs until CRM/email is wired. */
export const consoleContactDispatcher: ContactDispatcher = {
  async dispatch(input) {
    console.info("[contact]", input.topic, input.email, input.name);
  },
};
