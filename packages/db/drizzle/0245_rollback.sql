-- 'artist_application_image' stays on shop_media_kind: PostgreSQL cannot drop an enum label.
-- Images already uploaded keep their media rows; an older shop-api never offers the kind.
DROP TABLE IF EXISTS "shop_artist_application_event";

DROP TABLE IF EXISTS "shop_artist_application_work";

DROP TABLE IF EXISTS "shop_artist_application";

DROP SEQUENCE IF EXISTS "shop_artist_application_reference_seq";

DROP TYPE IF EXISTS "public"."shop_artist_application_work_kind";

DROP TYPE IF EXISTS "public"."shop_artist_application_status";
