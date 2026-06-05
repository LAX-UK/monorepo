export type OnsiteEventPassEmailInput = {
  userName: string;
  eventTitle: string;
  segmentLabel: string;
  plusOneLine: string | null;
  notesLine: string | null;
  passUrl: string;
  qrPngBase64: string;
  opsEmail: string;
  arrivalNote: string | null;
  dressCode: string | null;
  kind: "confirmed" | "updated" | "resent";
};

function arrivalFooterLine(input: OnsiteEventPassEmailInput): string {
  const parts = [input.arrivalNote?.trim(), input.dressCode?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "Please have your pass ready at registration.";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function introLine(kind: OnsiteEventPassEmailInput["kind"], eventTitle: string): string {
  switch (kind) {
    case "confirmed":
      return `Thank you for confirming your attendance at ${eventTitle}.`;
    case "updated":
      return `Your RSVP for ${eventTitle} has been updated.`;
    case "resent":
      return `Here is your entry pass for ${eventTitle}.`;
  }
}

function subjectLine(kind: OnsiteEventPassEmailInput["kind"], eventTitle: string): string {
  switch (kind) {
    case "confirmed":
      return `RSVP confirmed — ${eventTitle}`;
    case "updated":
      return `RSVP updated — ${eventTitle}`;
    case "resent":
      return `Your entry pass — ${eventTitle}`;
  }
}

export function buildOnsiteEventPassEmailSubject(input: OnsiteEventPassEmailInput): string {
  return subjectLine(input.kind, input.eventTitle);
}

export function buildOnsiteEventPassEmailText(input: OnsiteEventPassEmailInput): string {
  const guestLine = input.plusOneLine ? `\n${input.plusOneLine}` : "";
  const notesLine = input.notesLine ? `\n${input.notesLine}` : "";
  return [
    `Dear ${input.userName},`,
    "",
    introLine(input.kind, input.eventTitle),
    "",
    `Attendance: ${input.segmentLabel}${guestLine}${notesLine}`,
    "",
    "Your entry pass",
    input.passUrl,
    "",
    "Please open this link before you arrive and have it ready at registration.",
    arrivalFooterLine(input),
    "",
    "We look forward to welcoming you.",
    "",
    `Questions: ${input.opsEmail}`,
  ].join("\n");
}

export function buildOnsiteEventPassEmailHtml(input: OnsiteEventPassEmailInput): string {
  const guestLine = input.plusOneLine
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#444;">${escapeHtml(input.plusOneLine)}</p>`
    : "";
  const notesLine = input.notesLine
    ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#444;">${escapeHtml(input.notesLine)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f4f0;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e8e4dc;">
        <tr><td style="padding:32px 28px 16px;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a7f72;">Entry pass</p>
          <h1 style="margin:0 0 16px;font-size:24px;font-weight:400;line-height:1.3;color:#1a1a1a;">${escapeHtml(input.eventTitle)}</h1>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#333;">Dear ${escapeHtml(input.userName)},</p>
          <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#333;">${escapeHtml(introLine(input.kind, input.eventTitle))}</p>
          <p style="margin:0 0 8px;font-size:15px;line-height:1.5;color:#444;"><strong>Attendance:</strong> ${escapeHtml(input.segmentLabel)}</p>
          ${guestLine}
          ${notesLine}
        </td></tr>
        <tr><td align="center" style="padding:8px 28px 24px;">
          <img src="data:image/png;base64,${input.qrPngBase64}" width="240" height="240" alt="Entry pass QR code" style="display:block;border:1px solid #e8e4dc;">
        </td></tr>
        <tr><td style="padding:0 28px 24px;text-align:center;">
          <a href="${escapeHtml(input.passUrl)}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:14px;letter-spacing:0.04em;">Open entry pass</a>
        </td></tr>
        <tr><td style="padding:0 28px 32px;">
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#666;">Please open this link before you arrive and have it ready at registration.</p>
          <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#666;">${escapeHtml(arrivalFooterLine(input))}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#666;">Questions: <a href="mailto:${escapeHtml(input.opsEmail)}" style="color:#1a1a1a;">${escapeHtml(input.opsEmail)}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
