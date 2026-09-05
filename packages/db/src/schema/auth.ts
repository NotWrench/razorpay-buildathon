import {
  boolean,
  index,
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

export const apikey = pgTable(
  "apikey",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    expiresAt: timestamp("expires_at"),
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    metadata: jsonb("metadata").$type<ApiKeyMetadata>(),
    name: text("name"),
    permissions: text("permissions"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("apikey_userId_idx").on(table.userId),
    uniqueIndex("apikey_key_uidx").on(table.key),
  ]
);
