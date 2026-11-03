import { describe, expect, it } from "vitest";
import {
  OWN_REQUEST_REASON,
  extendState,
  outcomeState,
  recordActions,
  rowActions,
} from "./data-request-actions";
import {
  closedRecord,
  delayedDownload,
  downloadRecord,
  dueSoonManual,
  extendedRecord,
  failedDownload,
  manualRecord,
  overdueManual,
  ownRecord,
  waitingManual,
  waitingRecord,
} from "./data-request.fixture";

describe("record actions", () => {
  it("offers Close as the next step of an open manual request", () => {
    const actions = recordActions(manualRecord);
    expect(actions.primary).toBe("close");
    expect(actions.close.kind).toBe("enabled");
    expect(actions.editNotes.kind).toBe("enabled");
    expect(actions.continueManually.kind).toBe("hidden");
    expect(actions.recordIdReceived.kind).toBe("hidden");
  });

  it("disables Extend with the original due date once it has passed", () => {
    expect(recordActions(manualRecord).extend).toEqual({
      kind: "disabled",
      reason: "The original due date, 1 Nov 2026, has passed.",
    });
  });

  it("offers Extend before the original due date", () => {
    const soon = { ...manualRecord, request: dueSoonManual };
    expect(recordActions(soon).extend.kind).toBe("enabled");
  });

  it("allows one extension only", () => {
    expect(recordActions(extendedRecord).extend).toEqual({
      kind: "disabled",
      reason: "Already extended once.",
    });
  });

  it("waits for the ID before the clock, the extension or a gathered product", () => {
    const actions = recordActions(waitingRecord);
    expect(actions.primary).toBe("id-received");
    expect(actions.recordIdReceived.kind).toBe("enabled");
    expect(actions.extend.kind).toBe("disabled");
    expect(actions.gather("bid")).toEqual({
      kind: "disabled",
      reason: "Record when the proof of identity arrived first.",
    });
  });

  it("lets a gathered product be unmarked, and hides products outside the scope", () => {
    const actions = recordActions(manualRecord);
    expect(actions.gather("bid").kind).toBe("enabled");
    expect(actions.gather("shop").kind).toBe("enabled");
    expect(actions.gather("account").kind).toBe("hidden");
  });

  it("closed requests have no actions", () => {
    const actions = recordActions(closedRecord);
    expect(actions.primary).toBeNull();
    for (const state of [
      actions.extend,
      actions.close,
      actions.editNotes,
      actions.gather("shop"),
    ]) {
      expect(state.kind).toBe("hidden");
    }
  });

  it("offers only Continue manually on a delayed download, and never a primary action", () => {
    const actions = recordActions(downloadRecord);
    expect(actions.primary).toBeNull();
    expect(actions.continueManually.kind).toBe("enabled");
    expect(actions.close.kind).toBe("hidden");
    expect(actions.extend.kind).toBe("hidden");
  });

  it("does not offer Continue again once a download was continued, or while it is collecting", () => {
    const continued = { ...downloadRecord, request: { ...failedDownload, continuedAs: "DR-0013" } };
    expect(recordActions(continued).continueManually.kind).toBe("hidden");
    const collecting = {
      ...downloadRecord,
      request: { ...delayedDownload, status: "collecting" as const },
    };
    expect(recordActions(collecting).continueManually.kind).toBe("hidden");
  });

  it("is view only on a request about the signed-in person: nothing is offered", () => {
    const actions = recordActions(ownRecord);
    expect(actions.viewOnlyReason).toBe(OWN_REQUEST_REASON);
    expect(actions.continueManually.kind).toBe("hidden");
    const own = { ...manualRecord, ownRequest: true };
    const manualOwn = recordActions(own);
    expect(
      [manualOwn.close, manualOwn.extend, manualOwn.editNotes, manualOwn.gather("bid")].every(
        (s) => s.kind === "hidden",
      ),
    ).toBe(true);
    expect(manualOwn.primary).toBeNull();
  });
});

describe("row actions", () => {
  it("matches the record's rules from the row alone", () => {
    expect(rowActions(overdueManual).extend.kind).toBe("disabled");
    expect(rowActions(dueSoonManual).extend.kind).toBe("enabled");
    expect(rowActions(dueSoonManual).close.kind).toBe("enabled");
    expect(rowActions(failedDownload).continueManually.kind).toBe("enabled");
    expect(rowActions(failedDownload).close.kind).toBe("hidden");
  });

  it("has no actions for a closed request", () => {
    expect(rowActions({ ...overdueManual, status: "closed" })).toEqual({
      continueManually: { kind: "hidden" },
      extend: { kind: "hidden" },
      close: { kind: "hidden" },
    });
  });

  it("explains why a request waiting for ID can't be extended", () => {
    expect(extendState(waitingManual)).toMatchObject({ kind: "disabled" });
  });
});

describe("outcome choices", () => {
  it("only a refusal or a withdrawal can close a request still waiting for ID", () => {
    expect(outcomeState("sent", waitingManual).kind).toBe("disabled");
    expect(outcomeState("sent_partial", waitingManual).kind).toBe("disabled");
    expect(outcomeState("nothing_held", waitingManual).kind).toBe("disabled");
    expect(outcomeState("refused", waitingManual).kind).toBe("enabled");
    expect(outcomeState("withdrawn", waitingManual).kind).toBe("enabled");
  });

  it("every outcome is open once the clock is running", () => {
    expect(outcomeState("sent", overdueManual).kind).toBe("enabled");
  });
});
