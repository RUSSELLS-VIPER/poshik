"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Mail,
  Lock,
  User,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

const registerSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character"
    ),
  role: z.enum(["OWNER", "DOCTOR", "SHOP", "ADMIN"], {
    required_error: "Please select a role",
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;
type RegisterResponseData = {
  message?: string;
  email?: string;
  emailSent?: boolean;
};

const roleLabels = {
  OWNER: "Pet Owner",
  DOCTOR: "Veterinarian",
  SHOP: "Pet Shop",
  ADMIN: "Administrator",
};

const roleDescriptions = {
  OWNER: "Find trusted veterinarians and pet shops",
  DOCTOR: "Provide veterinary services to pet owners",
  SHOP: "Sell pet products and supplies",
  ADMIN: "Manage the platform",
};

export default function RegisterForm() {
  const [statusMessage, setStatusMessage] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [isError, setIsError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "OWNER",
    },
  });

  const password = watch("password") ?? "";

  const onSubmit = async (data: RegisterFormData) => {
    setStatusMessage("");
    setVerificationEmail("");
    setIsError(false);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = (await response.json()) as RegisterResponseData;

      if (!response.ok) {
        setIsError(true);
        setStatusMessage(responseData?.message ?? "Registration failed");
        return;
      }

      if (responseData?.emailSent === false) {
        setIsError(true);
        setStatusMessage(
          responseData?.message ??
            "Account created, but verification email could not be sent right now."
        );
        return;
      }

      setVerificationEmail(responseData?.email ?? data.email);

      setStatusMessage(
        responseData?.message ??
          "Registration successful! Check your email to verify your account."
      );

      setTimeout(() => {
        router.push("/login");
      }, 2500);
    } catch {
      setIsError(true);
      setVerificationEmail("");
      setStatusMessage("Registration failed. Please try again.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {statusMessage ? (
        <div
          className={
            isError
              ? "flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
              : "flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          }
        >
          {isError ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="space-y-1">
            <p>{statusMessage}</p>
            {!isError && verificationEmail ? (
              <p className="font-medium">
                Verification email sent to:{" "}
                <span className="break-all">{verificationEmail}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Full Name
        </label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="name"
            type="text"
            placeholder="Full Name"
            autoComplete="name"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            {...register("name")}
            aria-invalid={errors.name ? "true" : "false"}
          />
        </div>
        {errors.name ? (
          <p className="text-sm text-rose-600">{errors.name.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          Email Address
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            {...register("email")}
            aria-invalid={errors.email ? "true" : "false"}
          />
        </div>
        {errors.email ? (
          <p className="text-sm text-rose-600">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Password
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Create a strong password"
            autoComplete="new-password"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pl-10 pr-10 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
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
          <p className="text-sm text-rose-600">{errors.password.message}</p>
        ) : null}

        <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-600">
            Password checklist
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            <li
              className={
                password.length >= 8 ? "text-emerald-700" : "text-slate-500"
              }
            >
              - At least 8 characters
            </li>
            <li
              className={
                /[A-Z]/.test(password) ? "text-emerald-700" : "text-slate-500"
              }
            >
              - One uppercase letter
            </li>
            <li
              className={
                /[a-z]/.test(password) ? "text-emerald-700" : "text-slate-500"
              }
            >
              - One lowercase letter
            </li>
            <li
              className={
                /[0-9]/.test(password) ? "text-emerald-700" : "text-slate-500"
              }
            >
              - One number
            </li>
            <li
              className={
                /[^A-Za-z0-9]/.test(password)
                  ? "text-emerald-700"
                  : "text-slate-500"
              }
            >
              - One special character
            </li>
          </ul>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="role" className="text-sm font-medium text-slate-700">
          I am a
        </label>
        <select
          id="role"
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          {...register("role")}
        >
          {(Object.keys(roleLabels) as Array<keyof typeof roleLabels>).map(
            (value) => (
              <option key={value} value={value}>
                {roleLabels[value]} - {roleDescriptions[value]}
              </option>
            )
          )}
        </select>
        {errors.role ? (
          <p className="text-sm text-rose-600">{errors.role.message}</p>
        ) : null}
      </div>

      <button
        type="submit"
        className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:from-emerald-800 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create Account"
        )}
      </button>
    </form>
  );
}
