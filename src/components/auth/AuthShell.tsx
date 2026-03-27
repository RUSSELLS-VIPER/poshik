import Link from "next/link";
import { HeartPulse, PawPrint, ShieldCheck } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerCtaLabel: string;
  footerCtaHref: string;
};

const highlights = [
  {
    icon: ShieldCheck,
    title: "Verified Access",
    description: "Secure email verification and role-based accounts.",
  },
  {
    icon: PawPrint,
    title: "Pet-Centered",
    description: "Everything from pet care tracking to quick discovery.",
  },
  {
    icon: HeartPulse,
    title: "Care Network",
    description: "Owners, vets, and shops on one collaborative platform.",
  },
];

export default function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footerText,
  footerCtaLabel,
  footerCtaHref,
}: AuthShellProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-16 -top-16 h-56 w-56 rounded-full bg-emerald-100/70 blur-2xl" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-amber-100/70 blur-2xl" />
      </div>

      <div className="relative grid lg:grid-cols-2">
        <aside className="hidden border-r border-slate-200 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 p-10 text-white lg:block">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/90">
            Poshik
          </p>
          <h2 className="mt-4 text-3xl font-semibold leading-tight">
            Care platform for modern pet lives.
          </h2>
          <p className="mt-3 text-sm text-emerald-100/90">
            A connected space where pet owners, doctors, and shops work
            together with clarity and trust.
          </p>

          <div className="mt-10 space-y-4">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm"
              >
                <item.icon className="h-5 w-5 text-amber-200" />
                <h3 className="mt-2 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-emerald-100/90">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </aside>

        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">{title}</h1>
          <p className="mt-2 text-sm text-slate-600">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <p className="mt-8 text-center text-sm text-slate-600">
            {footerText}{" "}
            <Link
              href={footerCtaHref}
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              {footerCtaLabel}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
