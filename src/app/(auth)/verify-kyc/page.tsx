"use client";

import { useSession } from "next-auth/react";
import KYCForm from "@/components/auth/KYCForm";

export default function KYCPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isEligible = role === "OWNER" || role === "SHOP";

  if (status === "loading") {
    return <p>Loading...</p>;
  }

  if (!session) {
    return <p>Please login first</p>;
  }

  if (!isEligible) {
    return (
      <div>
        <h2>KYC Verification</h2>
        <p>Only pet owner and shop owner can apply for KYC verification.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>KYC Verification</h2>
      <KYCForm />
    </div>
  );
}
