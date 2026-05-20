import { redirect } from "next/navigation";

/** Withdrawal queue merged into lots list (`?lens=attention`). */
export default function AdminLotsWithdrawalsRedirect() {
  redirect("/admin/lots?lens=attention");
}
