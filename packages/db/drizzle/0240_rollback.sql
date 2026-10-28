-- Forgets staff role assignments. Roll back the application release first: the previous release
-- reads the single staff role on bid_user_profile, which this release keeps in step with each
-- person's primary role, so nobody's access changes on the way back. Second roles and end dates
-- are lost.
DROP INDEX IF EXISTS "staff_role_assignment_role_idx";

DROP INDEX IF EXISTS "staff_role_assignment_user_idx";

DROP INDEX IF EXISTS "staff_role_assignment_open_uidx";

DROP TABLE IF EXISTS "staff_role_assignment";
