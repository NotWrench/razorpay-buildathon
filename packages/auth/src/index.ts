import { apiKey } from "@better-auth/api-key";
import { db } from "@workspace/db";
import {
  account,
  apikey,
  session,
  user,
  verification,
} from "@workspace/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      account,
      apikey,
      session,
      user,
      verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    apiKey({
      enableMetadata: true,
    }),
    nextCookies(),
  ],
  user: {
    additionalFields: {
      role: {
        defaultValue: "customer",
        input: true,
        required: false,
        type: "string",
      },
    },
  },
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
