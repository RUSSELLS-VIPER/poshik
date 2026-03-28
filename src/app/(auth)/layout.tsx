"use client";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-6xl px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
      {children}
    </section>
  );
}
