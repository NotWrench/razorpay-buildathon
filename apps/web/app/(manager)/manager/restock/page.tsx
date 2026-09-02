import type { Metadata } from "next";
import { RestockScreen } from "@/components/manager/restock-screen";
import { getRestock } from "@/lib/mock";

/** What is running out, plus whatever the assistant drafted about it. */

export const metadata: Metadata = { title: "Restock · Manager" };

export default async function ManagerRestockPage() {
  const { drafts, rows } = await getRestock();

  return <RestockScreen drafts={drafts} rows={rows} />;
}
