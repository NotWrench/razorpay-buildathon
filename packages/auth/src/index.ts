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

/**
 * Google is the only way in.
 *
 * One provider rather than a wall of them: every buyer and every store owner
 * arrives the same way, so there is one account per person and no "which
 * button did I press last time" — the failure mode that produces two accounts
 * and an order history split between them.
 *
 * Email and password stay enabled on the server and nowhere in the UI. The
 * seed mints the demo store's owner through `auth.api.signUpEmail`, and a
 * database has to have an owner before anyone can sign in as one.
 */

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Whether the Google credentials are present.
 *
 * Exported so the sign-in screen can say "Google sign-in is not configured"
 * instead of offering a button that redirects into a Google error page.
 */
export const isGoogleConfigured = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  account: {
    accountLinking: {
      /**
       * Google verifies its own addresses, so a Google sign-in on an email
       * that already exists is the same person — link it to that user rather
       * than refusing, or than quietly making a second account.
       *
       * This is what lets the store owner seeded with `SEED_OWNER_EMAIL` sign
       * in with Google and still own the store.
       */
      enabled: true,
      trustedProviders: ["google"],
    },
  },
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
  socialProviders: isGoogleConfigured
    ? {
        google: {
          clientId: googleClientId as string,
          clientSecret: googleClientSecret as string,
        },
      }
    : {},
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
