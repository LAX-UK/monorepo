import { bindPasskeyAdd } from "./passkey-add-dom.js";
import { hostedAuth } from "./window-auth.js";

bindPasskeyAdd(hostedAuth());
