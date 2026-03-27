"use client";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
      {children}
    </main>
  );
}
