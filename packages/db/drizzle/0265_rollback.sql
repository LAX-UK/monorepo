-- Rollback for 0265_organisation_contact_details. Roll back the application release first: the
-- previous release neither reads nor writes contact details. Saved contact details are lost.
SET LOCAL lock_timeout = '30s';

DROP TABLE IF EXISTS "legal_entity_contact_details";
