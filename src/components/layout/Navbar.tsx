"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Bell, CheckCheck, Loader2, Menu, X, PawPrint } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/discover", label: "Discover" },
  { href: "/owner", label: "Pet Owner" },
  { href: "/doctor", label: "Veterinary" },
  { href: "/shop", label: "Shop" },
  { href: "/admin", label: "Admin" },
  { href: "/api-docs", label: "API Docs" },
  { href: "/profile", label: "Profile" },
];

type NotificationItem = {
  _id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt?: string;
};

function formatNotificationTime(value?: string): string {
  if (!value) {
    return "Just now";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsNotificationOpen(false);
  }, [pathname]);

  const isLinkActive = useMemo(
    () => (href: string) => {
      if (!pathname) return false;
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname]
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  );

  const visibleNavLinks = useMemo(() => {
    const isAdmin = session?.user?.role === "ADMIN";
    return navLinks.filter((link) => link.href !== "/admin" || isAdmin);
  }, [session?.user?.role]);

  const loadNotifications = useCallback(async () => {
    if (status !== "authenticated") {
      setNotifications([]);
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const response = await fetch("/api/notifications?limit=8", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const responseData: unknown = await response.json();
      if (!Array.isArray(responseData)) {
        setNotifications([]);
        return;
      }

      setNotifications(
        responseData.map((item) => ({
          _id: String(item?._id ?? ""),
          title: String(item?.title ?? "Notification"),
          message: String(item?.message ?? ""),
          isRead: Boolean(item?.isRead),
          createdAt:
            typeof item?.createdAt === "string" ? item.createdAt : undefined,
        }))
      );
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [status]);

  const markNotificationAsRead = async (notificationId: string) => {
    if (!notificationId) {
      return;
    }

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((previous) =>
        previous.map((notification) =>
          notification._id === notificationId
            ? { ...notification, isRead: true }
            : notification
        )
      );
    } catch {
      // No-op: notification panel is a secondary UI affordance.
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((previous) =>
        previous.map((notification) => ({ ...notification, isRead: true }))
      );
    } catch {
      // No-op: notification panel is a secondary UI affordance.
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!isNotificationOpen) {
      return;
    }

    const onMouseDown = (event: MouseEvent) => {
      if (!notificationPanelRef.current) {
        return;
      }

      if (
        event.target instanceof Node &&
        !notificationPanelRef.current.contains(event.target)
      ) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [isNotificationOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-sm">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2 font-bold tracking-tight transition-all duration-300 hover:scale-105"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 shadow-md transition-all duration-300 group-hover:shadow-lg">
            <PawPrint className="h-4 w-4 text-white" />
          </div>
          <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-xl text-transparent">
            Poshik
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {/* Notifications */}
          {status === "authenticated" && (
            <div className="relative" ref={notificationPanelRef}>
              <button
                type="button"
                onClick={() => {
                  setIsNotificationOpen((previous) => !previous);
                  if (!isNotificationOpen) {
                    void loadNotifications();
                  }
                }}
                className="relative inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 transition-all duration-200 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
                aria-label="Open notifications"
                aria-expanded={isNotificationOpen}
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 animate-pulse items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-1 text-[10px] font-semibold text-white shadow-sm">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Panel */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-3 w-[340px] origin-top-right animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Notifications
                      </p>
                      <button
                        type="button"
                        onClick={() => void markAllNotificationsAsRead()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-all duration-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600"
                      >
                        <CheckCheck className="h-3.5 w-3.5" />
                        Mark all
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {isLoadingNotifications ? (
                        <div className="flex items-center justify-center px-4 py-8">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-teal-500" />
                            <span className="text-xs text-slate-500">
                              Loading notifications...
                            </span>
                          </div>
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <Bell className="mx-auto h-8 w-8 text-slate-300" />
                          <p className="mt-2 text-xs text-slate-400">
                            No notifications yet.
                          </p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification._id}
                            type="button"
                            onClick={() =>
                              void markNotificationAsRead(notification._id)
                            }
                            className={`group w-full border-b border-slate-100 px-4 py-3 text-left transition-all duration-200 hover:bg-slate-50 ${notification.isRead
                                ? "bg-white"
                                : "bg-gradient-to-r from-teal-50/50 to-transparent"
                              }`}
                          >
                            <p className="text-xs font-semibold text-slate-900 group-hover:text-teal-600">
                              {notification.title}
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              {notification.message}
                            </p>
                            <p className="mt-1.5 text-[10px] font-medium text-slate-400">
                              {formatNotificationTime(notification.createdAt)}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${isLinkActive(link.href)
                    ? "text-teal-600"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
              >
                {isLinkActive(link.href) && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" />
                )}
                {link.label}
              </Link>
            ))}
            <Link
              href="/register"
              className="ml-2 rounded-full bg-gradient-to-r from-slate-900 to-slate-700 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-slate-200"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((previous) => !previous)}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-all duration-200 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-600 lg:hidden"
            aria-label={
              isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="animate-in slide-in-from-top-2 duration-200 border-t border-slate-100 bg-white lg:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
            {visibleNavLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isLinkActive(link.href)
                    ? "bg-gradient-to-r from-teal-50 to-transparent text-teal-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/register"
              className="mt-2 rounded-lg bg-gradient-to-r from-slate-900 to-slate-700 px-3 py-2.5 text-center text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02]"
            >
              Get Started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
