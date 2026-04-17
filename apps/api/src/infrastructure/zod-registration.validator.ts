import { registerBodySchema } from "@auction/validators";
import type {
  IRegistrationValidator,
  RegistrationInput,
} from "../services/interfaces/registration.js";

export class ZodRegistrationValidator implements IRegistrationValidator {
  validate(input: RegistrationInput): { ok: true } | { ok: false; message: string } {
    const parsed = registerBodySchema.safeParse(input);
    if (!parsed.success) {
      const msg =
        parsed.error.issues.map((i: { message: string }) => i.message).join("; ") ||
        "Invalid input";
      return { ok: false, message: msg };
    }
    return { ok: true };
  }
}
