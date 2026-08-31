CREATE TABLE "agent_feedback" (
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note" text,
	"recommendation_id" uuid,
	"thumbs" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"intent" text NOT NULL,
	"mode" text,
	"outcome" text,
	"outcome_detail" text,
	"state" text DEFAULT 'open' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tool_calls" (
	"agent_type" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error_text" text,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" jsonb,
	"latency_ms" integer,
	"mode" text,
	"output_summary" jsonb,
	"step_number" integer,
	"status" text NOT NULL,
	"tool_call_id" text,
	"tool_name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_feedback" ADD CONSTRAINT "agent_feedback_recommendation_id_ai_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ai_recommendations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_calls" ADD CONSTRAINT "agent_tool_calls_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_feedback_conversationId_idx" ON "agent_feedback" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_feedback_recommendationId_idx" ON "agent_feedback" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "agent_tasks_conversationId_idx" ON "agent_tasks" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_tasks_state_idx" ON "agent_tasks" USING btree ("state");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_conversationId_idx" ON "agent_tool_calls" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_toolName_idx" ON "agent_tool_calls" USING btree ("tool_name");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_status_idx" ON "agent_tool_calls" USING btree ("status");--> statement-breakpoint
CREATE INDEX "agent_tool_calls_createdAt_idx" ON "agent_tool_calls" USING btree ("created_at");