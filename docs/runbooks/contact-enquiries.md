# Contact enquiries (LAX Bid)

Messages sent through the public contact form (`/contact`, every intent: general, buying, selling,
private sale, press, shipping, purchase problem when signed out) are stored in the Bid database and
worked by client services.

## How an enquiry travels

1. The web action checks the honeypot, validates the form and applies its per-address limit
   (4 per minute), then calls `POST /contact-enquiries` on the API.
2. The API limits per client address (5 per minute, 30 per day), validates the message with
   `contactEnquirySchema` and stores it in `marketing_enquiry` (status `new`). It publishes
   `marketing_enquiry.received` with the enquiry id and topic only; the message and contact
   details never enter the event.
3. A failed call shows the form's "We couldn't send your message" notice. The form never reports a
   success the API did not confirm.
4. The enquiry appears in the staff work inbox as "Contact enquiry" with a due time two business
   days after it arrived, matching the "We reply within two business days" copy. It is visible to
   client services and administrators. It opens at `/admin/enquiries/<id>`.
5. Client services reply from their own mail, then choose **Mark handled**. That records
   `marketing_enquiry.handled` with the person who did it in the audit log (Operations view).

## Alert email

| Variable | Service | Meaning |
| --- | --- | --- |
| `BID_ENQUIRY_NOTIFICATION_EMAIL` | api | Staff inbox that receives one alert email per enquiry through the email outbox. Unset means no email; the work inbox still lists every enquiry. |

The alert is queued after the enquiry is stored. If it cannot be queued the enquiry is kept and an
error is logged with the enquiry id.

## Rollback

`packages/db/drizzle/0272_rollback.sql` drops `marketing_enquiry`; stored enquiries are lost. Roll
back the application release first.
