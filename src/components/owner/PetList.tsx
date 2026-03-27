"use client";

import { useEffect, useState } from "react";
import { PawPrint } from "lucide-react";

type PetItem = {
  _id: string;
  name: string;
  type?: string;
  breed?: string;
  age?: number;
  isPublic?: boolean;
};

type PetListProps = {
  refreshKey?: number;
};

export default function PetList({ refreshKey = 0 }: PetListProps) {
  const [pets, setPets] = useState<PetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const loadPets = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/pets", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Could not load pets.");
        }

        const data: unknown = await response.json();
        if (!isCancelled) {
          setPets(Array.isArray(data) ? (data as PetItem[]) : []);
        }
      } catch {
        if (!isCancelled) {
          setErrorMessage("Could not load pets right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPets();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Your Pets</h3>
          <p className="text-sm text-slate-600">
            View and manage all pet profiles linked to your account.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
          {pets.length} profile{pets.length === 1 ? "" : "s"}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50"
            />
          ))}
        </div>
      ) : null}

      {errorMessage ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {!isLoading && !errorMessage && pets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
          <PawPrint className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No pet profiles yet
          </p>
          <p className="text-xs text-slate-500">
            Add your first pet profile using the form above.
          </p>
        </div>
      ) : null}

      {!isLoading && !errorMessage && pets.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {pets.map((pet) => (
            <article
              key={pet._id}
              className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">
                    {pet.name}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {pet.breed ?? "Breed not provided"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    pet.isPublic
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {pet.isPublic ? "Public" : "Private"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  Type: <span className="font-medium">{pet.type ?? "-"}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                  Age:{" "}
                  <span className="font-medium">
                    {typeof pet.age === "number" ? `${pet.age} yrs` : "-"}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
