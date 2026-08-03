CREATE TYPE "public"."sale_hero_presentation" AS ENUM('cover', 'video');--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "hero_presentation" "sale_hero_presentation" DEFAULT 'cover' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale" ADD COLUMN "hero_video_url" text;
