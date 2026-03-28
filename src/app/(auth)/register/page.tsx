import { Metadata } from "next";
import RegisterForm from "@/components/auth/RegisterForm";
import AuthShell from "@/components/auth/AuthShell";

export const metadata: Metadata = {
  title: "Register | Poshik",
  description: "Create your Poshik account",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-6xl items-center py-1 sm:py-2">
      <AuthShell
        eyebrow="Get Started"
        title="Create Your Account"
        subtitle="Join Poshik to discover care providers, manage your pets, and stay on top of appointments."
        footerText="Already have an account?"
        footerCtaLabel="Login now"
        footerCtaHref="/login"
      >
        <RegisterForm />
      </AuthShell>
    </div>
  );
}
