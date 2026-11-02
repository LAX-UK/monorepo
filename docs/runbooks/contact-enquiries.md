# Contact enquiries (LAX Bid)

Messages sent through the public contact form (`/contact`, every intent: general, buying, selling,
private sale, press, shipping, purchase problem when signed out) are stored in the Bid database and
worked by client services.

## How an enquiry travels

1. The web action checks the honeypot, validates the form and applies its per-address limit
   (4 per minute), then calls `POST /contact-enquiries` on the API.
2. The API limits per client address (5 per minute, 30 per day), validates the message with
   `enquiryIntakeSchema` and stores it in `marketing_enquiry` (status `new`) with a reference
   (`E-1001` upwards). The schema has one path per `intent`: `general`, `private_sale_sell` and
   `private_sale_buy`. A payload with no intent is the contact form's original shape and is read as
   a general enquiry; its topic and a leading "Private sale enquiry" line decide the stored intent.
   Private sale answers are stored in `private_sale_enquiry_detail`. The enquiry is routed on
   receipt: the specialist for its department in `enquiry_routing_rule`, else the fallback row,
   else nobody. It publishes `marketing_enquiry.received` (id, intent and department) and, when
   routed, `marketing_enquiry.assigned`; the message and contact details never enter an event.
3. A failed call shows the form's "We couldn't send your message" notice. The form never reports a
   success the API did not confirm.
4. The enquiry appears in the staff work inbox as "Contact enquiry" with a due time two business
   days after it arrived, matching the "We reply within two business days" copy. It is visible to
   client services and administrators. It opens at `/admin/enquiries/<id>`.
5. Client services reply from their own mail, then choose **Mark handled**. That closes the
   enquiry and records `marketing_enquiry.handled` with the person who did it in the audit log
   (Operations view).

## Working an enquiry

Staff use `GET /admin/enquiries` (views: assigned to me, open, unassigned, private sales, closed,
all; filters on kind, department, status and assignee; cursor paging) and
`GET /admin/enquiries/<reference or id>`. `PATCH /admin/enquiries/<reference>` assigns, changes the
status (new, in progress, waiting on client, closed with a reason, converted by the convert flow
only), and adds an internal note. The request carries the `version` the person read; a change made
against an older version answers 409 with the current version. Assignments and status changes are
audited as `marketing_enquiry.assigned` and `.status_changed`.

Private sale enquiries are visible only to roles holding `enquiries.private_sale.read`
(administrator, sales manager, specialist, client services). The service hides them from everyone
else, including the person they are assigned to. Administrators and sales managers set the routing
table with `PUT /admin/enquiry-routing`; each changed row is audited as `enquiry_routing.changed`.
## Alert email

| Variable | Service | Meaning |
| --- | --- | --- |
| `BID_ENQUIRY_NOTIFICATION_EMAIL` | api | Staff inbox that receives one alert email per enquiry through the email outbox. Unset means no email; the work inbox still lists every enquiry. |

The alert is queued after the enquiry is stored. If it cannot be queued the enquiry is kept and an
error is logged with the enquiry id.

## Rollback

`packages/db/drizzle/0275_rollback.sql` removes the reference, intent, owner and workflow columns,
the private sale detail, attachment, note, message and routing tables, and returns every closed
enquiry to `handled` and every other one to `new`. `packages/db/drizzle/0274_rollback.sql` drops
`marketing_enquiry`; stored enquiries are lost. Roll back the application release first, and roll
back `0275` before `0274`.
