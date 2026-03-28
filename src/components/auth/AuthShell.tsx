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
    <section className="relative w-full overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/95 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.6)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-100/80 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-amber-100/70 blur-3xl" />
      </div>

      <div className="relative grid xl:grid-cols-[0.95fr,1.05fr]">
        <aside className="hidden border-r border-slate-200/40 bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-800 p-7 text-white xl:block">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-100/90">
            Poshik
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">
            One place for trusted pet care.
          </h2>
          <p className="mt-2 text-sm text-emerald-100/90">
            A connected space where pet owners, doctors, and shops work
            together with clarity and trust.
          </p>

          <div className="mt-7 space-y-3">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-sm"
              >
                <item.icon className="h-5 w-5 text-amber-200" />
                <h3 className="mt-1.5 text-sm font-semibold">{item.title}</h3>
                <p className="mt-0.5 text-xs text-emerald-100/90">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </aside>

        <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto p-4 sm:p-5 lg:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">{subtitle}</p>

          <div className="mt-3 grid grid-cols-3 gap-2 xl:hidden">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-center"
              >
                <item.icon className="mx-auto h-4 w-4 text-emerald-700" />
                <p className="mt-1 text-[10px] font-semibold text-slate-700">
                  {item.title}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5">{children}</div>

          <p className="mt-5 text-center text-sm text-slate-600">
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
