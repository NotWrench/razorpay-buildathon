CREATE TABLE "agent_memory_long" (
	"buyer_identifier" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"importance_score" real NOT NULL,
	"last_accessed" timestamp DEFAULT now() NOT NULL,
	"memory_key" text NOT NULL,
	"memory_value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendations" (
	"accepted" boolean DEFAULT false NOT NULL,
	"confidence_score" real NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"recommendation_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"explanation" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"metadata" jsonb,
	"order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "conversation_messages" (
	"content" text NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"tool_calls" jsonb
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"buyer_identifier" text NOT NULL,
	"buyer_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failures" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"error_message" text NOT NULL,
	"error_type" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid,
	"recovery_action" text,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reasoning_logs" (
	"action_taken" text NOT NULL,
	"confidence" real NOT NULL,
	"conversation_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_number" integer NOT NULL,
	"thought_summary" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_messages" ADD CONSTRAINT "conversation_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reasoning_logs" ADD CONSTRAINT "reasoning_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memory_long_buyerIdentifier_idx" ON "agent_memory_long" USING btree ("buyer_identifier");--> statement-breakpoint
CREATE INDEX "agent_memory_long_memoryKey_idx" ON "agent_memory_long" USING btree ("memory_key");--> statement-breakpoint
CREATE INDEX "ai_recommendations_conversationId_idx" ON "ai_recommendations" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "ai_recommendations_productId_idx" ON "ai_recommendations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "audit_logs_merchantId_idx" ON "audit_logs" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_orderId_idx" ON "audit_logs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actorType_idx" ON "audit_logs" USING btree ("actor_type");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversations_merchantId_idx" ON "conversations" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "conversations_buyerIdentifier_idx" ON "conversations" USING btree ("buyer_identifier");--> statement-breakpoint
CREATE INDEX "failures_orderId_idx" ON "failures" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "failures_errorType_idx" ON "failures" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "failures_resolved_idx" ON "failures" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "reasoning_logs_conversationId_idx" ON "reasoning_logs" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "reasoning_logs_stepNumber_idx" ON "reasoning_logs" USING btree ("step_number");