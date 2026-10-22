import { formatAdminDetailDateTime } from "@/lib/admin-detail-format";
import type { EnquiryContextLink } from "@/server/domain/enquiry-detail.vm";
import { enquirySenderName, enquiryStaffName } from "@/server/domain/enquiry-inbox.vm";
import type { AdminEnquiryDetail, AdminEnquiryNote } from "@auction/shop-contracts";

const linkClass =
  "text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function EnquiryMessage({ message }: { message: string }) {
  return (
    <section aria-labelledby="enquiry-message-heading">
      <h2 id="enquiry-message-heading" className="mb-3 text-lg font-medium text-on-surface">
        Message
      </h2>
      <p className="whitespace-pre-wrap rounded-lg border border-border-hairline bg-surface-container-lowest p-4 text-sm leading-relaxed text-on-surface">
        {message || "No message was written."}
      </p>
    </section>
  );
}

export function EnquiryNotesThread({ notes }: { notes: AdminEnquiryNote[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-on-surface-variant">No notes yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-lg border border-border-hairline bg-surface-container-lowest p-4"
        >
          <p className="whitespace-pre-wrap text-sm text-on-surface">{note.body}</p>
          <p className="mt-2 text-xs text-on-surface-variant">
            {enquiryStaffName(note.author)} ·{" "}
            <time dateTime={note.createdAt}>{formatAdminDetailDateTime(note.createdAt)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}

export function EnquirySenderSection({ sender }: { sender: AdminEnquiryDetail["sender"] }) {
  return (
    <section aria-labelledby="enquiry-sender-heading">
      <h2 id="enquiry-sender-heading" className="mb-3 text-lg font-medium text-on-surface">
        Sender
      </h2>
      <dl className="grid gap-2 text-sm">
        <div>
          <dt className="text-on-surface-variant">Name</dt>
          <dd className="text-on-surface">
            {enquirySenderName(sender)}{" "}
            <span className="text-on-surface-variant">
              ({sender.type === "member" ? "member" : "guest"})
            </span>
          </dd>
        </div>
        {sender.email ? (
          <div>
            <dt className="text-on-surface-variant">Email</dt>
            <dd>
              <a href={`mailto:${sender.email}`} className={linkClass}>
                {sender.email}
              </a>
            </dd>
          </div>
        ) : null}
        {sender.phone ? (
          <div>
            <dt className="text-on-surface-variant">Phone</dt>
            <dd>
              <a href={`tel:${sender.phone.replace(/\s+/g, "")}`} className={linkClass}>
                {sender.phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

export function EnquiryContextSection({ links }: { links: EnquiryContextLink[] }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="enquiry-context-heading">
      <h2 id="enquiry-context-heading" className="mb-3 text-lg font-medium text-on-surface">
        Context
      </h2>
      <dl className="grid gap-2 text-sm">
        {links.map((link) => (
          <div key={`${link.label}:${link.text}`}>
            <dt className="text-on-surface-variant">{link.label}</dt>
            <dd>
              {link.href ? (
                <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  {link.text}
                  <span className="sr-only"> (opens lax.art in a new tab)</span>
                </a>
              ) : (
                <span className="text-on-surface">{link.text}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
