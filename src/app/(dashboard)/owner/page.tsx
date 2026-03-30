"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { HeartPulse, MapPinned, PawPrint } from "lucide-react";
import PetForm from "@/components/owner/PetForm";
import PetList from "@/components/owner/PetList";
import PetMap from "@/components/owner/PetMap";

export default function OwnerDashboard() {
  const { data: session, status } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading your owner dashboard...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800 shadow-sm">
          Login required to access the owner dashboard.
        </div>
      </div>
    );
  }

  const firstName =
    session.user?.name?.trim().split(" ").filter(Boolean)[0] ?? "Pet Parent";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-700 via-violet-700 to-violet-700 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-16 -bottom-16 h-44 w-44 rounded-full bg-violet-300/20 blur-3xl" />
        </div>

        <div className="relative">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
            Owner Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-emerald-50/90 sm:text-base">
            Manage pet profiles, track nearby companions on the map, and keep
            your pet activity organized from one clean workspace.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PawPrint className="h-4 w-4" />
                Multi-pet Profiles
              </div>
              <p className="mt-1 text-xs text-emerald-50/90">
                Keep all your pets under one account.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPinned className="h-4 w-4" />
                Nearby Discovery
              </div>
              <p className="mt-1 text-xs text-emerald-50/90">
                View public pet locations on the live map.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
              <div className="flex items-center gap-2 text-sm font-medium">
                <HeartPulse className="h-4 w-4" />
                Care-Ready Tools
              </div>
              <p className="mt-1 text-xs text-emerald-50/90">
                Stay ready for appointments and updates.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6">
          <PetForm
            ownerId={session.user.id ?? ""}
            onPetCreated={() => setRefreshKey((value) => value + 1)}
          />
          <PetList refreshKey={refreshKey} />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <PetMap refreshKey={refreshKey} />
        </section>
      </div>
    </div>
  );
}
