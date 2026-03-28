"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type LoginFormProps = {
  verifiedState?: string;
};

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginForm({ verifiedState }: LoginFormProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const verificationMessages = {
    success: {
      message: "Email verified successfully! You can now login.",
      type: "success",
    },
    already: {
      message: "Email was already verified. Please login.",
      type: "success",
    },
    missing: {
      message: "Verification link is incomplete. Please request a new one.",
      type: "error",
    },
    invalid: {
      message: "Verification link is invalid or expired. Please request a new one.",
      type: "error",
    },
    error: {
      message: "Could not verify email. Please try again or request a new link.",
      type: "error",
    },
  };

  const verificationInfo = verifiedState
    ? verificationMessages[verifiedState as keyof typeof verificationMessages]
    : null;

  const onSubmit = async (data: LoginFormData) => {
    setErrorMessage("");

    const result = await signIn("credentials", {
      email: data.email.trim().toLowerCase(),
      password: data.password,
      redirect: false,
    });

    if (result?.error) {
      setErrorMessage(result.error);
      return;
    }

    if (result?.ok) {
      router.push("/profile");
      router.refresh();
      return;
    }

    setErrorMessage("Login failed. Please try again.");
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {verificationInfo ? (
        <div
          className={
            verificationInfo.type === "success"
              ? "flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
              : "flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          }
        >
          {verificationInfo.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{verificationInfo.message}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
        />
        {errors.email ? (
          <p className="text-xs text-rose-600">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100"
            {...register("password")}
            aria-invalid={errors.password ? "true" : "false"}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-rose-600">{errors.password.message}</p>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <button
        type="submit"
        className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging in...
          </>
        ) : (
          "Login"
        )}
      </button>
    </form>
  );
}
