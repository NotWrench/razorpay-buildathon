-- The api-key table's owner column, on its way to the plugin's own name.
--
-- Split into a drop here and the additions in 0015 because drizzle-kit asks
-- interactively whether a dropped column and an added one are a rename, and
-- there is no answer to give it in a non-interactive shell. Two unambiguous
-- migrations are safer than a guessed answer; the table is empty either way.
ALTER TABLE "apikey" DROP CONSTRAINT "apikey_user_id_user_id_fk";--> statement-breakpoint
DROP INDEX "apikey_userId_idx";--> statement-breakpoint
ALTER TABLE "apikey" DROP COLUMN "user_id";
