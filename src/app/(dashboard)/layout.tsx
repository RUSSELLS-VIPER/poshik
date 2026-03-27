export default function Layout({ children }: { children: React.ReactNode }) {
  return <section className="w-full min-w-0 space-y-4 sm:space-y-6">{children}</section>;
}
