CREATE TABLE "build_requirements" (
	"budget_paise" integer,
	"constraints" jsonb,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owned_parts" jsonb,
	"target_refresh_hz" integer,
	"target_resolution" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"use_case" text,
	"workloads" jsonb,
	CONSTRAINT "build_requirements_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
ALTER TABLE "build_requirements" ADD CONSTRAINT "build_requirements_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "build_requirements_conversationId_idx" ON "build_requirements" USING btree ("conversation_id");