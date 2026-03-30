import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p className="font-medium text-slate-700">
          © {new Date().getFullYear()} Poshik. All rights reserved.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="transition hover:text-violet-700">
            Home
          </Link>
          <Link href="/discover" className="transition hover:text-violet-700">
            Discover
          </Link>
          <Link href="/shop" className="transition hover:text-violet-700">
            Shop
          </Link>
          <Link href="/profile" className="transition hover:text-violet-700">
            Profile
          </Link>
        </div>
      </div>
    </footer>
  );
}
