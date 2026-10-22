import { HelpCategoriesPage } from "@/components/help/help-categories-page";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Help centre categories" };

export default function HelpCategoriesRoute() {
  return <HelpCategoriesPage />;
}
