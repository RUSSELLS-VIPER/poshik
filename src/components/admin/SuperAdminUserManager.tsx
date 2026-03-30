"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  PawPrint,
  ShieldCheck,
} from "lucide-react";

type ManagedRole = "OWNER" | "DOCTOR" | "SHOP";
type RoleFilter = "ALL" | ManagedRole;
type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

type ManagedUser = {
  _id: string;
  name?: string;
  email?: string;
  role: ManagedRole;
  kycStatus: KycStatus;
  emailVerified?: boolean;
  isActive?: boolean;
  phone?: string;
  createdAt?: string;
  latestKyc?: {
    _id?: string;
    documentUrl?: string;
    status?: KycStatus;
    updatedAt?: string;
  } | null;
};

type ManagedPet = {
  _id: string;
  name?: string;
  type?: string;
  breed?: string;
  age?: number;
  imageUrl?: string;
  isPublic?: boolean;
  createdAt?: string;
  ownerId?:
    | {
        _id?: string;
        name?: string;
        role?: string;
      }
    | string
    | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
} | null;

const roleLabel: Record<ManagedRole, string> = {
  OWNER: "Pet Owner",
  DOCTOR: "Doctor",
  SHOP: "Shop Owner",
};

const roleFilterLabel: Record<RoleFilter, string> = {
  ALL: "All",
  OWNER: "Pet Owners",
  DOCTOR: "Doctors",
  SHOP: "Shop Owners",
};

function formatCreatedAt(value?: string): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function SuperAdminUserManager() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const hasLoadedRef = useRef(false);

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [pets, setPets] = useState<ManagedPet[]>([]);
  const [search, setSearch] = useState("");
  const [activeRoleFilter, setActiveRoleFilter] = useState<RoleFilter>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPets, setIsLoadingPets] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [petsError, setPetsError] = useState("");

  const loadUsers = useCallback(
    async (searchTerm?: string) => {
      if (role !== "ADMIN") {
        setIsLoading(false);
        return;
      }

      if (!hasLoadedRef.current) {
        setIsLoading(true);
      }
      setIsRefreshing(true);
      setFeedback(null);

      try {
        const params = new URLSearchParams({
          roles: "OWNER,DOCTOR,SHOP",
        });

        const normalizedSearch = (searchTerm ?? search).trim();
        if (normalizedSearch) {
          params.set("search", normalizedSearch);
        }

        const response = await fetch(`/api/users?${params.toString()}`, {
          cache: "no-store",
        });
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData?.message ?? "Could not fetch users.");
        }

        setUsers(Array.isArray(responseData) ? responseData : []);
        hasLoadedRef.current = true;
      } catch (error) {
        setFeedback({
          type: "error",
          message:
            error instanceof Error ? error.message : "Could not fetch users.",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [role, search]
  );

  const loadPets = useCallback(async () => {
    if (role !== "ADMIN") {
      setIsLoadingPets(false);
      return;
    }

    setIsLoadingPets(true);
    setPetsError("");

    try {
      const response = await fetch("/api/pets", {
        cache: "no-store",
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch pets.");
      }

      setPets(Array.isArray(responseData) ? (responseData as ManagedPet[]) : []);
    } catch (error) {
      setPetsError(
        error instanceof Error ? error.message : "Could not fetch pets."
      );
    } finally {
      setIsLoadingPets(false);
    }
  }, [role]);

  useEffect(() => {
    if (status === "authenticated" && role === "ADMIN") {
      void Promise.all([loadUsers(""), loadPets()]);
    } else if (status !== "loading") {
      setIsLoading(false);
      setIsLoadingPets(false);
    }
  }, [status, role, loadUsers, loadPets]);

  const usersByRole = useMemo(
    () => ({
      OWNER: users.filter((user) => user.role === "OWNER"),
      DOCTOR: users.filter((user) => user.role === "DOCTOR"),
      SHOP: users.filter((user) => user.role === "SHOP"),
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    if (activeRoleFilter === "ALL") return users;
    return users.filter((user) => user.role === activeRoleFilter);
  }, [activeRoleFilter, users]);

  const userOwnedPets = useMemo(
    () =>
      pets.filter((pet) => {
        if (pet.ownerId && typeof pet.ownerId === "object") {
          return pet.ownerId.role !== "ADMIN";
        }
        return true;
      }),
    [pets]
  );

  const patchUser = async (
    userId: string,
    updates: Partial<Pick<ManagedUser, "kycStatus" | "isActive" | "role">>
  ) => {
    setFeedback(null);
    setUpdatingUserId(userId);

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not update user.");
      }

      const updatedUser = responseData?.user as ManagedUser | undefined;
      if (updatedUser?._id) {
        setUsers((previous) =>
          previous.map((user) => (user._id === updatedUser._id ? updatedUser : user))
        );
      }

      setFeedback({
        type: "success",
        message: responseData?.message ?? "User updated successfully.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not update user.",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading super admin dashboard...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800 shadow-sm">
          Login required to access admin panel.
        </div>
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800 shadow-sm">
          This page is for super admin only.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-700 via-violet-700 to-violet-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
          Super Admin
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Manage All Users, Shop Owners, and Doctors
        </h1>
        <p className="mt-2 text-sm text-violet-100/90">
          Search accounts, update roles, verify KYC, and control access from one
          place. You can also host community events for all users.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Pet Owners</p>
            <p className="text-2xl font-semibold">{usersByRole.OWNER.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Doctors</p>
            <p className="text-2xl font-semibold">{usersByRole.DOCTOR.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Shop Owners</p>
            <p className="text-2xl font-semibold">{usersByRole.SHOP.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-violet-50 to-violet-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
              Community Events
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              Host Events as Admin
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Create and manage public events that users can join from discover.
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-violet-700" />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/events"
            className="inline-flex items-center justify-center rounded-lg bg-gradient-to-r from-violet-700 to-violet-700 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-800 hover:to-violet-800"
          >
            Open Event Host Panel
          </Link>
          <Link
            href="/discover"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            View Public Discover
          </Link>
        </div>
      </section>

      {feedback ? (
        <div
          className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{feedback.message}</p>
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void loadUsers();
              }
            }}
            placeholder="Search by name or email"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          />

          <select
            value={activeRoleFilter}
            onChange={(event) => setActiveRoleFilter(event.target.value as RoleFilter)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          >
            <option value="ALL">Filter: All Roles</option>
            <option value="OWNER">Filter: Pet Owners</option>
            <option value="DOCTOR">Filter: Doctors</option>
            <option value="SHOP">Filter: Shop Owners</option>
          </select>

          <button
            type="button"
            onClick={() => void loadUsers()}
            disabled={isRefreshing}
            className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRefreshing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Refreshing...
              </span>
            ) : (
              "Search"
            )}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Pets Owned By Users ({userOwnedPets.length})
          </h2>
          <PawPrint className="h-5 w-5 text-slate-600" />
        </div>

        {isLoadingPets ? (
          <p className="text-sm text-slate-600">Loading pets...</p>
        ) : petsError ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {petsError}
          </p>
        ) : userOwnedPets.length === 0 ? (
          <p className="text-sm text-slate-600">No user-owned pets found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Pet</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Details</th>
                  <th className="px-3 py-2">Visibility</th>
                  <th className="px-3 py-2">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {userOwnedPets.map((pet) => {
                  const owner =
                    pet.ownerId && typeof pet.ownerId === "object"
                      ? pet.ownerId
                      : null;

                  return (
                    <tr key={pet._id} className="align-top">
                      <td className="px-3 py-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={pet.imageUrl?.trim() || "/images/default-pet.png"}
                              alt={pet.name || "Pet"}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {pet.name || "Unnamed pet"}
                            </p>
                            <p className="text-xs text-slate-500">ID: {pet._id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-900">
                          {owner?.name || "Unknown owner"}
                        </p>
                        <p className="text-xs text-slate-500">
                          Role: {owner?.role || "Unknown"}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {(pet.type || "-") + " • " + (pet.breed || "Unknown breed")}
                        <br />
                        {typeof pet.age === "number" ? `${pet.age} yrs` : "Age -"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                            pet.isPublic
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {pet.isPublic ? "Public" : "Private"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">
                        {formatCreatedAt(pet.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            {roleFilterLabel[activeRoleFilter]} ({filteredUsers.length})
          </h2>
        </div>

        {filteredUsers.length === 0 ? (
          <p className="text-sm text-slate-600">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">KYC</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Joined</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="align-top">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-slate-900">
                        {user.name || "Unnamed user"}
                      </p>
                      <p className="text-xs text-slate-600">{user.email}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Email: {user.emailVerified ? "Verified" : "Not verified"}
                      </p>
                      {user.latestKyc?.documentUrl ? (
                        <a
                          href={user.latestKyc.documentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-block text-xs text-violet-700 underline"
                        >
                          View KYC document
                        </a>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">
                          KYC document not uploaded
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-3">
                      <select
                        value={user.role}
                        onChange={(event) =>
                          void patchUser(user._id, {
                            role: event.target.value as ManagedRole,
                          })
                        }
                        disabled={updatingUserId === user._id}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        <option value="OWNER">{roleLabel.OWNER}</option>
                        <option value="DOCTOR">{roleLabel.DOCTOR}</option>
                        <option value="SHOP">{roleLabel.SHOP}</option>
                      </select>
                    </td>

                    <td className="px-3 py-3">
                      <select
                        value={user.kycStatus}
                        onChange={(event) =>
                          void patchUser(user._id, {
                            kycStatus: event.target.value as KycStatus,
                          })
                        }
                        disabled={updatingUserId === user._id}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600">
                      {user.isActive === false ? "Inactive" : "Active"}
                    </td>

                    <td className="px-3 py-3 text-xs text-slate-600">
                      {formatCreatedAt(user.createdAt)}
                    </td>

                    <td className="px-3 py-3">
                      <button
                        type="button"
                        disabled={updatingUserId === user._id}
                        onClick={() =>
                          void patchUser(user._id, {
                            isActive: user.isActive === false,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                          user.isActive === false
                            ? "border-emerald-300 text-emerald-700"
                            : "border-rose-300 text-rose-700"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {user.isActive === false ? "Activate" : "Deactivate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
