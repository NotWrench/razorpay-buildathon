import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/auth-screen";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return <AuthScreen mode="signup" />;
}
