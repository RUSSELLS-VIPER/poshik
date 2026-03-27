import { Metadata } from "next";
import LoginForm from "@/components/auth/LoginForm";
import AuthShell from "@/components/auth/AuthShell";

type LoginPageProps = {
  searchParams?: {
    verified?: string;
  };
};

export const metadata: Metadata = {
  title: "Login | Poshik",
  description: "Login to your Poshik account",
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <AuthShell
        eyebrow="Welcome Back"
        title="Login To Your Account"
        subtitle="Continue where you left off and manage your pets, services, and orders in one place."
        footerText="New to Poshik?"
        footerCtaLabel="Create an account"
        footerCtaHref="/register"
      >
        <LoginForm verifiedState={searchParams?.verified} />
      </AuthShell>
    </div>
  );
}
