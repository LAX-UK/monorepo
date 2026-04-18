UPDATE "user" SET "role" = 'user' WHERE "role" IN ('buyer', 'seller');
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';
