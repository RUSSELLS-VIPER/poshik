"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Compass, Loader2, MapPinned, PawPrint, Search } from "lucide-react";

type LatLng = {
  lat: number;
  lng: number;
};

type DiscoverPet = {
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
      }
    | string
    | null;
  location?: {
    type?: "Point";
    coordinates?: number[];
  };
};

type GoogleMap = {
  fitBounds: (bounds: GoogleLatLngBounds) => void;
  setCenter: (center: LatLng) => void;
  setZoom: (zoom: number) => void;
};

type GoogleLatLngBounds = {
  extend: (position: LatLng) => void;
};

type GoogleMarker = {
  addListener: (eventName: string, handler: () => void) => void;
};

type GoogleInfoWindow = {
  open: (options: { map: GoogleMap; anchor: GoogleMarker }) => void;
};

type GoogleMaps = {
  Map: new (
    element: HTMLElement,
    options: {
      center: LatLng;
      zoom: number;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
    }
  ) => GoogleMap;
  Marker: new (options: {
    map: GoogleMap;
    position: LatLng;
    title?: string;
  }) => GoogleMarker;
  InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
  LatLngBounds: new () => GoogleLatLngBounds;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: GoogleMaps;
  };
};

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_MAP_CENTER: LatLng = { lat: 23.8103, lng: 90.4125 };

let googleMapsScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const mapsWindow = window as GoogleMapsWindow;
  if (mapsWindow.google?.maps) {
    return Promise.resolve();
  }

  if (!googleMapsScriptPromise) {
    googleMapsScriptPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        "script[data-google-maps-script='true']"
      );

      const fail = () => {
        googleMapsScriptPromise = null;
        reject(new Error("Google Maps script failed to load."));
      };

      if (existingScript) {
        if ((window as GoogleMapsWindow).google?.maps) {
          resolve();
          return;
        }

        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", fail, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;
      script.dataset.googleMapsScript = "true";
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener("error", fail, { once: true });
      document.head.appendChild(script);
    });
  }

  return googleMapsScriptPromise;
}

function getOwnerName(pet: DiscoverPet): string {
  if (pet.ownerId && typeof pet.ownerId === "object" && pet.ownerId.name) {
    return pet.ownerId.name;
  }
  return "Unknown owner";
}

function getPetPosition(pet: DiscoverPet): LatLng | null {
  const coordinates = pet.location?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (
    Number.isNaN(lat) ||
    Number.isNaN(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  // Ignore default "not set" coordinates from schema.
  if (lat === 0 && lng === 0) {
    return null;
  }

  return { lat, lng };
}

function getSafeImageUrl(url?: string): string {
  if (!url) return "/images/default-pet.png";
  const normalized = url.trim();
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://")
  ) {
    return normalized;
  }
  return "/images/default-pet.png";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildInfoContent(pet: DiscoverPet): string {
  const petName = escapeHtml(pet.name || "Pet");
  const petBreed = escapeHtml(pet.breed || "Unknown breed");
  const petType = escapeHtml(pet.type || "Unknown type");
  const ownerName = escapeHtml(getOwnerName(pet));
  const petImage = escapeHtml(getSafeImageUrl(pet.imageUrl));
  const visibility = pet.isPublic === false ? "Private" : "Public";

  return `
    <div style="min-width:180px;max-width:220px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <img src="${petImage}" alt="${petName}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;" />
      <div style="margin-top:8px;">
        <div style="font-weight:600;color:#0f172a;">${petName}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${petBreed}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${petType}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Owner: ${ownerName}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Visibility: ${visibility}</div>
      </div>
    </div>
  `;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function OwnerDiscoverPage() {
  const { data: session, status } = useSession();
  const [pets, setPets] = useState<DiscoverPet[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [mapError, setMapError] = useState("");
  const [mappedPetCount, setMappedPetCount] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      if (status !== "loading") {
        setIsLoading(false);
      }
      return;
    }

    let isCancelled = false;

    const loadOtherUsersPets = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/pets?discover=true", {
          cache: "no-store",
        });
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData?.message ?? "Could not fetch pets.");
        }

        if (!isCancelled) {
          setPets(Array.isArray(responseData) ? responseData : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not fetch pets."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOtherUsersPets();

    return () => {
      isCancelled = true;
    };
  }, [status]);

  const filteredPets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pets;

    return pets.filter((pet) =>
      [pet.name, pet.type, pet.breed, getOwnerName(pet)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [pets, search]);

  const mappablePets = useMemo(
    () =>
      filteredPets
        .map((pet) => ({ pet, position: getPetPosition(pet) }))
        .filter(
          (entry): entry is { pet: DiscoverPet; position: LatLng } =>
            entry.position !== null
        ),
    [filteredPets]
  );

  useEffect(() => {
    if (!session || status !== "authenticated") {
      return;
    }

    if (!mapContainerRef.current) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      setMappedPetCount(0);
      setMapError(
        "Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local."
      );
      return;
    }

    if (mappablePets.length === 0) {
      setMappedPetCount(0);
      setMapError("No saved pet locations found for the current results.");
      return;
    }

    let isCancelled = false;
    setMappedPetCount(mappablePets.length);
    setMapError("");

    const renderMap = async () => {
      try {
        await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY);

        if (isCancelled || !mapContainerRef.current) {
          return;
        }

        const maps = (window as GoogleMapsWindow).google?.maps;
        if (!maps) {
          setMapError("Google Maps failed to initialize.");
          return;
        }

        const firstPosition = mappablePets[0]?.position ?? DEFAULT_MAP_CENTER;
        const map = new maps.Map(mapContainerRef.current, {
          center: firstPosition,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new maps.LatLngBounds();

        mappablePets.forEach(({ pet, position }) => {
          const marker = new maps.Marker({
            map,
            position,
            title: pet.name || "Pet",
          });

          const infoWindow = new maps.InfoWindow({
            content: buildInfoContent(pet),
          });

          marker.addListener("click", () => {
            infoWindow.open({ map, anchor: marker });
          });

          bounds.extend(position);
        });

        if (mappablePets.length > 1) {
          map.fitBounds(bounds);
        } else {
          map.setCenter(firstPosition);
          map.setZoom(12);
        }

        setMapError("");
      } catch {
        if (!isCancelled) {
          setMapError("Could not load discover map. Please try again.");
        }
      }
    };

    void renderMap();

    return () => {
      isCancelled = true;
    };
  }, [session, status, mappablePets]);

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading discover pets...
          </span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Login required to explore pets from other users.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-sky-200 bg-gradient-to-r from-sky-700 via-blue-700 to-cyan-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
          Discover
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Explore All Pets From Other Users
        </h1>
        <p className="mt-2 text-sm text-sky-100/90">
          Browse profiles and view them on the map when location is available.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-sky-100/90">Other Users&apos; Pets</p>
            <p className="text-2xl font-semibold">{pets.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-sky-100/90">Search Results</p>
            <p className="text-2xl font-semibold">{filteredPets.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-sky-100/90">Mapped Results</p>
            <p className="text-2xl font-semibold">{mappedPetCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by pet name, type, breed, or owner..."
              className="w-full rounded-xl border border-slate-300 px-9 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
            />
          </label>

          <Link
            href="/owner"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Back to Owner
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-sky-700" />
          <h2 className="text-lg font-semibold text-slate-900">Discover Map</h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Showing pets that have saved location coordinates.
        </p>

        {mapError ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {mapError}
          </p>
        ) : null}

        <div
          ref={mapContainerRef}
          className="mt-3 h-[320px] w-full rounded-xl border border-slate-200 bg-slate-100 sm:h-[420px]"
        />
      </section>

      {errorMessage ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {errorMessage}
        </section>
      ) : null}

      {!errorMessage && filteredPets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Compass className="mx-auto h-6 w-6 text-slate-500" />
          <p className="mt-2 text-sm font-medium text-slate-700">
            No pets found for your current search.
          </p>
          <p className="text-xs text-slate-500">
            Try a different keyword to discover more pets.
          </p>
        </section>
      ) : null}

      {!errorMessage && filteredPets.length > 0 ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPets.map((pet) => (
            <article
              key={pet._id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getSafeImageUrl(pet.imageUrl)}
                  alt={pet.name || "Pet"}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {pet.name || "Unnamed pet"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Shared by {getOwnerName(pet)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      pet.isPublic === false
                        ? "border-slate-300 bg-slate-100 text-slate-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                    }`}
                  >
                    {pet.isPublic === false ? "Private" : "Public"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    Type: <span className="font-medium">{pet.type || "-"}</span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
                    Age:{" "}
                    <span className="font-medium">
                      {typeof pet.age === "number" ? `${pet.age} yrs` : "-"}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-slate-700">
                  Breed:{" "}
                  <span className="font-medium">{pet.breed || "Not provided"}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Added on: {formatDate(pet.createdAt)}
                </p>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="inline-flex items-center gap-2 text-xs text-slate-600">
          <PawPrint className="h-3.5 w-3.5" />
          Showing all pets from other users. Map points appear only for pets with
          valid saved location.
        </p>
      </section>
    </main>
  );
}
