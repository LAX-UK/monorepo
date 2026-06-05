import { applyPublicConfig } from "./apply-event-config.js";
import { applyFooterLinks } from "./apply-footer-links.js";
import { applyPageAssets } from "./apply-page-assets.js";
import { clearEmailFromUrl, parseEmailFromUrl } from "./config.js";
import { initLotCarousel } from "./lot-carousel.js";
import { initPageEffects } from "./page-effects.js";
import { type SegmentOption, fetchEventConfig, lookupByEmail, submitRsvp } from "./rsvp-api.js";
import { RsvpFormController } from "./rsvp-form.js";
import { lookupToState } from "./rsvp-state.js";

async function bootstrap() {
  applyPageAssets();
  applyFooterLinks();
  initPageEffects();
  void initLotCarousel();

  const mount = document.getElementById("rsvp-panel");
  if (!mount) return;

  mount.classList.add("rsvp-panel--loading");

  let activeUser = { name: "", email: "" };
  let segmentOptions: SegmentOption[] = [];
  let controller!: RsvpFormController;

  try {
    const config = await fetchEventConfig();
    segmentOptions = config.segmentOptions;
    applyPublicConfig(config);
    if (!config.rsvpOpen) {
      controller = new RsvpFormController(mount, {
        onEmailSubmit: async () => undefined,
        onSubmit: async () => undefined,
        onRetry: () => undefined,
        onChangeEmail: () => undefined,
      });
      mount.classList.remove("rsvp-panel--loading");
      controller.setState({ kind: "event_closed" });
      return;
    }
  } catch {
    mount.classList.remove("rsvp-panel--loading");
    mount.textContent = "We couldn't load RSVP details. Please refresh and try again.";
    return;
  }

  async function runEmailLookup(email: string) {
    controller.setState({ kind: "checking_email" });
    try {
      const lookup = await lookupByEmail(email);
      const state = lookupToState(lookup, email);
      if (state.kind === "form") {
        activeUser = state.user;
        segmentOptions = state.segmentOptions;
        clearEmailFromUrl();
      }
      controller.setState(state);
    } catch {
      controller.setState({
        kind: "error",
        message: "We couldn't reach the server. Please check your connection and try again.",
      });
    }
  }

  controller = new RsvpFormController(mount, {
    onEmailSubmit: runEmailLookup,
    onSubmit: async (values) => {
      controller.setState({ kind: "submitting", user: activeUser, segmentOptions });
      try {
        const result = await submitRsvp({
          email: activeUser.email,
          attendanceSegment: values.attendanceSegment,
          plusOne: values.plusOne,
          ...(values.plusOne > 0 && values.guestName ? { plusOneGuestName: values.guestName } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        });
        controller.setState({ kind: "success", result, user: activeUser, segmentOptions });
      } catch (e) {
        const code = e instanceof Error ? e.message : "submit_failed";
        const message =
          code === "event_closed"
            ? "RSVPs for this event are now closed."
            : code === "not_registered"
              ? "Create a lax.bid account to reserve your spot."
              : code === "suspended"
                ? "This invitation is for active lax.bid clients."
                : "We couldn't save your RSVP. Please try again.";
        controller.setState({ kind: "error", message });
      }
    },
    onRetry: () => controller.setState({ kind: "email_prompt" }),
    onChangeEmail: () => {
      activeUser = { name: "", email: "" };
      clearEmailFromUrl();
      controller.setPendingEmail("");
      controller.setState({ kind: "email_prompt" });
    },
  });

  mount.classList.remove("rsvp-panel--loading");

  const resumeEmail = parseEmailFromUrl();
  if (resumeEmail) {
    controller.setPendingEmail(resumeEmail);
    await runEmailLookup(resumeEmail);
  } else {
    controller.setState({ kind: "email_prompt" });
  }

  if (window.location.hash === "#rsvp") {
    const target = document.getElementById("rsvp");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

void bootstrap();
