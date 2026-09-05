import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  id: text("id").primaryKey(),
  image: text("image"),
  name: text("name").notNull(),
  role: text("role", { enum: ["merchant", "customer"] })
    .default("customer")
    .notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    ipAddress: text("ip_address"),
    token: text("token").notNull().unique(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)]
);

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    idToken: text("id_token"),
    /** Required by better-auth >= 1.7 to disambiguate OIDC providers. */
    issuer: text("issuer"),
    password: text("password"),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("account_provider_account_uidx").on(
      table.providerId,
      table.accountId
    ),
    index("account_userId_idx").on(table.userId),
  ]
);

export const verification = pgTable(
  "verification",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    value: text("value").notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)]
);

/**
 * What a merchant decided about one buying agent.
 *
 * Kept on better-auth's own row rather than in a table beside it, because a
 * second table would need its own lifecycle against a key that better-auth
 * already creates, revokes and expires — and the two would drift the first
 * time a key was deleted through the library instead of through us.
 *
 * `merchantId` is the part that matters. Without it a key issued by one shop
 * authenticates against every shop on the platform, and the manifest's promise
 * that a key "identifies you as an ai_agent buyer" would be true and useless.
 * `spendCapPaise` makes the published bound per-counterparty instead of
 * per-deployment: a merchant can trust one agent with ₹2 lakh and another with
 * ₹5,000, which is what having a relationship with a customer means.
 */
export interface ApiKeyMetadata {
  /**
   * What this counterparty may spend without waking the merchant.
   *
   * Distinct from `spendCapPaise`, which is the most they may commit at all.
   * This is the most they may commit *unattended*, and it can only ever be
   * stricter than the store-wide `merchant_policy` number — trusting one agent
   * further must not raise the shop's own ceiling. Absent falls back to the
   * store's number, which is why it is optional rather than defaulted to zero.
   */
  autoApproveCeilingPaise?: number;
  dailyBudget?: number;
  /** Who the merchant thinks this is. Shown on the agents screen. */
  label?: string;
  maxTxBudget?: number;
  /** The store this key may trade with. Absent on keys issued before scoping. */
  merchantId?: string;
  monthlyBudget?: number;
  /** This agent's own cap, overriding the platform default when present. */
  spendCapPaise?: number;
  [key: string]: unknown;
}

/**
 * The columns are the plugin's, not ours.
 *
 * better-auth's drizzle adapter validates every field it is about to write
 * against this table and refuses the whole call if one is missing — so a
 * schema that has drifted from the installed `@better-auth/api-key` does not
 * degrade, it makes `createApiKey` throw. That is what had happened here: the
 * table still carried `user_id` and none of `configId`, `start`, `prefix` or
 * the rate-limit block, so issuing a key from `/manager/agents` failed with
 * "The field configId does not exist" — and issuing a key is the first step of
 * the one journey this project exists to demonstrate.
 *
 * `referenceId` replaces `user_id` and is the plugin's own name for the owner
 * of a key. `resolveActor` already read `result.key.referenceId`, so the
 * application code was ahead of the schema rather than the other way round.
 *
 * The foreign key to `user` is not restored with the rename. The plugin treats
 * this column as an opaque reference — its `references` option can point it at
 * an organization instead — and a constraint the library does not know about
 * is one it can break by writing a legal value.
 *
 * `metadata` stays `jsonb` while the plugin declares it a string. The plugin
 * hands the adapter a JSON string, Postgres parses it into `jsonb` on the way
 * in, and everything that reads it — `resolveActor`, `listAgentKeys` — wants
 * the object it gets back. Storing it as `text` would mean two of those three
 * had to learn to parse.
 */
export const apikey = pgTable(
  "apikey",
  {
    /** Which api-key configuration issued this. The plugin defaults it. */
    configId: text("config_id").default("default").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    lastRefillAt: timestamp("last_refill_at"),
    lastRequest: timestamp("last_request"),
    metadata: jsonb("metadata").$type<ApiKeyMetadata>(),
    name: text("name"),
    permissions: text("permissions"),
    /** First characters of the key, safe to display. */
    prefix: text("prefix"),
    rateLimitEnabled: boolean("rate_limit_enabled").default(true).notNull(),
    rateLimitMax: integer("rate_limit_max"),
    rateLimitTimeWindow: integer("rate_limit_time_window"),
    /** Who the key belongs to. A user id here; the plugin allows others. */
    referenceId: text("reference_id").notNull(),
    refillAmount: integer("refill_amount"),
    refillInterval: integer("refill_interval"),
    /** Requests left before the key stops working. Null means unlimited. */
    remaining: integer("remaining"),
    requestCount: integer("request_count").default(0).notNull(),
    start: text("start"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("apikey_referenceId_idx").on(table.referenceId),
    index("apikey_configId_idx").on(table.configId),
    uniqueIndex("apikey_key_uidx").on(table.key),
  ]
);
