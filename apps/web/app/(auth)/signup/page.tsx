import { redirect } from "next/navigation";
import { shellRoutes } from "@/lib/routes";

/**
 * There is no sign-up.
 *
 * Google creates the account on the first sign-in, so a second screen would
 * only be the same button under a different heading. The route stays so the
 * links that pointed at it keep working.
 */
export default function SignupPage() {
  redirect(shellRoutes.login);
}
