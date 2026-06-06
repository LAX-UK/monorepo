import {
  CATALOGUE_URL,
  EVENTS_EMAIL,
  EVENT_DETAILS,
  MAPS_URL,
  registerUrlForEmail,
} from "./config.js";
import { downloadOpeningEventCalendar } from "./rsvp-calendar.js";
import { type RsvpUiState, segmentLabel } from "./rsvp-state.js";

const NOTES_MAX = 500;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(
  label: string,
  onClick: () => void,
  opts?: { primary?: boolean; disabled?: boolean },
) {
  const node = el(
    "button",
    opts?.primary ? "rsvp-btn rsvp-btn-primary" : "rsvp-btn",
    label,
  ) as HTMLButtonElement;
  node.type = "button";
  if (opts?.disabled) node.disabled = true;
  node.addEventListener("click", onClick);
  return node;
}

function linkButton(label: string, href: string, primary = false, newTab = false) {
  const node = el(
    "a",
    primary ? "rsvp-btn rsvp-btn-primary" : "rsvp-btn",
    label,
  ) as HTMLAnchorElement;
  node.href = href;
  if (newTab) {
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  return node;
}

export type FormSubmitHandler = (values: {
  attendanceSegment: string;
  plusOne: number;
  guestName: string;
  notes: string;
}) => void | Promise<void>;

export type EmailSubmitHandler = (email: string) => void | Promise<void>;

export class RsvpFormController {
  private state: RsvpUiState = { kind: "email_prompt" };
  private onEmailSubmit: EmailSubmitHandler;
  private onSubmit: FormSubmitHandler;
  private onRetry: () => void;
  private onChangeEmail: () => void;
  private pendingEmail = "";

  constructor(
    private readonly mount: HTMLElement,
    handlers: {
      onEmailSubmit: EmailSubmitHandler;
      onSubmit: FormSubmitHandler;
      onRetry: () => void;
      onChangeEmail: () => void;
    },
  ) {
    this.onEmailSubmit = handlers.onEmailSubmit;
    this.onSubmit = handlers.onSubmit;
    this.onRetry = handlers.onRetry;
    this.onChangeEmail = handlers.onChangeEmail;
  }

  getState(): RsvpUiState {
    return this.state;
  }

  setState(state: RsvpUiState) {
    this.state = state;
    this.render();
  }

  private render() {
    this.mount.replaceChildren();
    this.mount.setAttribute("aria-live", "polite");

    const card = el("div", "rsvp-card rsvp-card-enter");

    switch (this.state.kind) {
      case "email_prompt":
        card.append(this.renderSteps(1), this.renderEmailPrompt());
        break;
      case "checking_email":
        card.append(
          this.renderSteps(1),
          el("p", "rsvp-message rsvp-loading", "Checking your details…"),
        );
        break;
      case "new_guest":
        card.append(this.renderSteps(1), this.renderNewGuest(this.state.email));
        break;
      case "suspended":
        card.append(
          this.renderMessageBlock(
            "This invitation is for active lax.bid clients. Contact our events team if you need assistance.",
            [linkButton(`EMAIL ${EVENTS_EMAIL}`, `mailto:${EVENTS_EMAIL}`, true)],
          ),
        );
        break;
      case "event_closed":
        card.append(
          this.renderMessageBlock(
            "RSVPs for this event are now closed. Contact events@lax.bid for assistance.",
            [linkButton(`EMAIL ${EVENTS_EMAIL}`, `mailto:${EVENTS_EMAIL}`, true)],
          ),
        );
        break;
      case "error":
        card.append(
          this.renderMessageBlock(this.state.message, [
            button("Try again", () => this.onRetry(), { primary: true }),
          ]),
        );
        break;
      case "submitting":
        card.append(
          this.renderSteps(2),
          el("p", "rsvp-message rsvp-loading", "Confirming your attendance…"),
        );
        break;
      case "success":
        card.append(this.renderSteps(3), this.renderSuccess());
        break;
      case "form":
        card.append(this.renderSteps(2), this.renderForm());
        break;
    }

    this.mount.append(card);
  }

  private renderSteps(active: 1 | 2 | 3) {
    const nav = el("nav", "rsvp-steps", undefined);
    nav.setAttribute("aria-label", "RSVP progress");

    const steps = [
      { n: 1, label: "Your email" },
      { n: 2, label: "Attendance" },
      { n: 3, label: "Confirmed" },
    ] as const;

    for (const step of steps) {
      const item = el("div", `rsvp-step${step.n === active ? " rsvp-step-active" : ""}`);
      if (step.n === active) {
        item.setAttribute("aria-current", "step");
      }
      item.append(el("span", "rsvp-step-num", String(step.n)));
      item.append(el("span", "rsvp-step-label", step.label));
      nav.append(item);
    }
    return nav;
  }

  private renderEmailPrompt() {
    const fragment = document.createDocumentFragment();

    fragment.append(
      el(
        "p",
        "rsvp-lead",
        "Enter the email address registered on lax.bid. We will match your details and take you straight to confirmation — no password required.",
      ),
    );

    const form = el("form", "rsvp-form") as HTMLFormElement;
    form.noValidate = true;

    const wrap = el("div", "rsvp-email");
    const label = el("label", "rsvp-label", "Email address") as HTMLLabelElement;
    const input = document.createElement("input");
    input.type = "email";
    input.name = "email";
    input.id = "rsvp-email";
    input.required = true;
    input.autocomplete = "email";
    input.inputMode = "email";
    input.placeholder = "you@example.com";
    if (this.pendingEmail) input.value = this.pendingEmail;
    label.htmlFor = "rsvp-email";
    wrap.append(label, input);
    form.append(wrap);

    const error = el("p", "rsvp-error");
    error.setAttribute("role", "alert");
    error.hidden = true;
    form.append(error);

    const submit = button("CONTINUE", () => undefined, { primary: true }) as HTMLButtonElement;
    submit.type = "submit";
    form.append(submit);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      error.hidden = true;
      const email = input.value.trim().toLowerCase();
      if (!email || !input.checkValidity()) {
        error.textContent = "Please enter a valid email address.";
        error.hidden = false;
        input.focus();
        return;
      }
      await this.onEmailSubmit(email);
    });

    fragment.append(form);
    queueMicrotask(() => input.focus());
    return fragment;
  }

  private renderNewGuest(email: string) {
    const fragment = document.createDocumentFragment();

    fragment.append(el("p", "rsvp-lead", "We do not yet have a lax.bid account for this address."));
    fragment.append(el("p", "rsvp-subtext", email));

    const list = el("ol", "rsvp-steps-list");
    list.append(el("li", undefined, "Create your lax.bid account (takes about two minutes)."));
    list.append(el("li", undefined, "Return to this page — your email will be remembered."));
    list.append(el("li", undefined, "Complete your attendance details and confirm."));
    fragment.append(list);

    const row = el("div", "rsvp-actions");
    row.append(linkButton("CREATE ACCOUNT", registerUrlForEmail(email), true));
    row.append(button("Use a different email", () => this.onChangeEmail()));
    fragment.append(row);

    return fragment;
  }

  private renderMessageBlock(message: string, actions: HTMLElement[], subtext?: string) {
    const fragment = document.createDocumentFragment();
    fragment.append(el("p", "rsvp-message", message));
    if (subtext) fragment.append(el("p", "rsvp-subtext", subtext));
    const row = el("div", "rsvp-actions");
    for (const action of actions) row.append(action);
    fragment.append(row);
    return fragment;
  }

  private formatEventDateTime(startsAt: string | null): string | null {
    if (!startsAt) return null;
    const date = new Date(startsAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
  }

  private renderSuccess() {
    if (this.state.kind !== "success") return document.createDocumentFragment();
    const { result, user, segmentOptions, eventConfig } = this.state;
    const fragment = document.createDocumentFragment();
    const eventTitle = eventConfig.title || EVENT_DETAILS.title;
    const eventWhen =
      this.formatEventDateTime(eventConfig.startsAt) ??
      `${EVENT_DETAILS.date} · ${EVENT_DETAILS.time}`;
    const venue = eventConfig.venue?.trim() || EVENT_DETAILS.venue;
    const dressCode = eventConfig.dressCode?.trim() || EVENT_DETAILS.dressCode;

    fragment.append(
      el("p", "rsvp-success", `Thank you, ${user.name}. Your place at ${eventTitle} is confirmed.`),
    );

    const details = el("dl", "rsvp-details");
    const addRow = (term: string, value: string) => {
      details.append(el("dt", undefined, term), el("dd", undefined, value));
    };
    addRow("Attendance", segmentLabel(segmentOptions, result.attendanceSegment));
    addRow(
      "Guest",
      result.plusOne > 0 ? `You + ${result.plusOneGuestName?.trim() || "1 guest"}` : "Just you",
    );
    addRow("Date", eventWhen);
    addRow("Venue", venue);
    addRow("Dress code", dressCode);
    if (result.notes?.trim()) addRow("Notes", result.notes.trim());
    fragment.append(details);

    fragment.append(
      el(
        "p",
        "rsvp-hint",
        `If you do not receive a confirmation email within a few minutes, open your entry pass below or contact ${EVENTS_EMAIL}. Show your pass QR at registration.`,
      ),
    );

    const row = el("div", "rsvp-actions");
    row.append(
      linkButton("View entry pass", result.passUrl, true, true),
      button("Add to calendar", () => downloadOpeningEventCalendar(result.attendanceSegment)),
      linkButton("Get directions", MAPS_URL),
      linkButton("Browse catalogue", CATALOGUE_URL),
    );
    fragment.append(row);
    return fragment;
  }

  private renderForm() {
    if (this.state.kind !== "form") return document.createDocumentFragment();
    const { user, existing, segmentOptions, draft, submitError } = this.state;
    const fragment = document.createDocumentFragment();

    const identity = el("div", "rsvp-identity");
    identity.append(el("p", "rsvp-label", "Confirming as"));
    identity.append(el("p", "rsvp-readonly", user.name));
    identity.append(el("p", "rsvp-readonly-email", user.email));
    const change = button("Change email", () => this.onChangeEmail());
    change.className = "rsvp-link-btn";
    identity.append(change);
    fragment.append(identity);

    if (existing) {
      fragment.append(
        el(
          "p",
          "rsvp-existing",
          `You are already confirmed for ${segmentLabel(segmentOptions, existing.attendanceSegment)}. Update below if your plans change.`,
        ),
      );
    } else {
      fragment.append(
        el(
          "p",
          "rsvp-lead",
          "Please tell us which part of the evening you plan to attend so we can arrange accordingly.",
        ),
      );
    }

    const form = el("form", "rsvp-form") as HTMLFormElement;
    form.noValidate = true;

    const group = el("fieldset", "rsvp-fieldset");
    const legend = el("legend", "rsvp-legend", "Which part of the evening will you attend? *");
    group.append(legend);
    group.setAttribute("role", "radiogroup");
    legend.id = "rsvp-segment-legend";
    group.setAttribute("aria-required", "true");
    group.setAttribute("aria-labelledby", "rsvp-segment-legend");

    const defaultSegment =
      draft?.attendanceSegment ?? existing?.attendanceSegment ?? segmentOptions[0]?.value ?? "";
    for (const option of segmentOptions) {
      const card = el("label", "rsvp-radio-card");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "attendanceSegment";
      input.value = option.value;
      input.checked = option.value === defaultSegment;
      input.required = true;
      card.append(input);
      const copy = el("span", "rsvp-radio-copy");
      copy.append(el("span", "rsvp-radio-title", option.label));
      if (option.helper) copy.append(el("span", "rsvp-radio-helper", option.helper));
      card.append(copy);
      group.append(card);
    }
    form.append(group);

    const plusWrap = el("div", "rsvp-plus-one");
    const plusLabel = el("label", "rsvp-label", "Bringing a guest? *") as HTMLLabelElement;
    const plusSelect = document.createElement("select");
    plusSelect.name = "plusOne";
    plusSelect.id = "plusOne";
    plusSelect.required = true;
    plusSelect.setAttribute("aria-label", "Bringing a guest");
    for (const value of ["0", "1"]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = value === "0" ? "No — attending alone" : "Yes — one guest (+1)";
      const plusOneDefault = draft?.plusOne ?? existing?.plusOne ?? 0;
      if (String(plusOneDefault) === value) opt.selected = true;
      plusSelect.append(opt);
    }
    plusLabel.htmlFor = "plusOne";
    plusWrap.append(plusLabel, plusSelect);
    form.append(plusWrap);

    const guestWrap = el("div", "rsvp-guest-name");
    guestWrap.hidden = (draft?.plusOne ?? existing?.plusOne ?? 0) === 0;
    const guestLabel = el("label", "rsvp-label", "Guest full name *") as HTMLLabelElement;
    const guestInput = document.createElement("input");
    guestInput.type = "text";
    guestInput.name = "guestName";
    guestInput.id = "rsvp-guest-name";
    guestInput.autocomplete = "name";
    guestInput.maxLength = 120;
    guestInput.value = draft?.guestName ?? existing?.plusOneGuestName ?? "";
    guestLabel.htmlFor = "rsvp-guest-name";
    guestWrap.append(guestLabel, guestInput);
    form.append(guestWrap);

    const notesWrap = el("div", "rsvp-notes");
    const notesLabel = el("label", "rsvp-label", "Additional notes") as HTMLLabelElement;
    const notes = document.createElement("textarea");
    notes.name = "notes";
    notes.id = "rsvp-notes";
    notes.maxLength = NOTES_MAX;
    notes.rows = 3;
    notes.placeholder = "Dietary requirements, accessibility needs, or other requests";
    notes.value = draft?.notes ?? existing?.notes ?? "";
    notes.setAttribute("aria-describedby", "rsvp-notes-hint");
    const hint = el("p", "rsvp-hint", `Optional. Up to ${NOTES_MAX} characters.`);
    hint.id = "rsvp-notes-hint";
    notesLabel.htmlFor = "rsvp-notes";
    notesWrap.append(notesLabel, notes, hint);
    form.append(notesWrap);

    const error = el("p", "rsvp-error");
    error.setAttribute("role", "alert");
    if (submitError) {
      error.textContent = submitError;
      error.hidden = false;
    } else {
      error.hidden = true;
    }
    form.append(error);

    const submit = button(existing ? "UPDATE RSVP" : "CONFIRM ATTENDANCE", () => undefined, {
      primary: true,
    }) as HTMLButtonElement;
    submit.type = "submit";
    form.append(submit);

    plusSelect.addEventListener("change", () => {
      guestWrap.hidden = plusSelect.value === "0";
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      error.hidden = true;
      const segmentInput = form.querySelector<HTMLInputElement>(
        'input[name="attendanceSegment"]:checked',
      );
      if (!segmentInput) {
        error.textContent = "Please select which part of the evening you plan to attend.";
        error.hidden = false;
        return;
      }
      const plusOne = Number.parseInt(plusSelect.value, 10);
      const guestName = guestInput.value.trim();
      if (plusOne > 0 && !guestName) {
        error.textContent = "Please enter your guest's full name.";
        error.hidden = false;
        guestInput.focus();
        return;
      }
      submit.disabled = true;
      try {
        await this.onSubmit({
          attendanceSegment: segmentInput.value,
          plusOne: Number.isFinite(plusOne) ? plusOne : 0,
          guestName,
          notes: notes.value.trim(),
        });
      } finally {
        submit.disabled = false;
      }
    });

    fragment.append(form);
    return fragment;
  }

  setPendingEmail(email: string) {
    this.pendingEmail = email;
  }
}
