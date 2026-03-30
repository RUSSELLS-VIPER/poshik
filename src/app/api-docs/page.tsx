import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import ApiDocsClient from "@/components/api/ApiDocsClient";
import { authOptions } from "@/lib/auth/auth";

export default async function ApiDocsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user?.role !== "ADMIN") {
    redirect("/");
  }

  return <ApiDocsClient />;
}
