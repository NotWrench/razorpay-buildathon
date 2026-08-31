ALTER TABLE "ai_recommendations" ADD COLUMN "additional_spend_paise" integer;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD COLUMN "replaces_product_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD COLUMN "tied_to_requirement" text;--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_upgrade_needs_a_reason" CHECK ("ai_recommendations"."recommendation_type" <> 'upgrade' or ("ai_recommendations"."tied_to_requirement" is not null and "ai_recommendations"."additional_spend_paise" is not null));