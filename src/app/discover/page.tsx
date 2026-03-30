"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  CalendarDays,
  Compass,
  Loader2,
  MapPin,
  MapPinned,
  PawPrint,
  Search,
  Users,
} from "lucide-react";

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

type CommunityEvent = {
  _id: string;
  title?: string;
  description?: string;
  location?: string;
  imageUrl?: string;
  startAt?: string;
  maxParticipants?: number | null;
  participantsCount?: number;
  isParticipating?: boolean;
  hostedBy?: {
    _id?: string;
    name?: string;
    role?: string;
  } | null;
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
  addListener?: (eventName: string, handler: () => void) => void;
};

type GoogleInfoWindow = {
  open: (options: { map: GoogleMap; anchor: GoogleMarker }) => void;
};

type PetMarkerDetails = {
  marker: GoogleMarker;
  infoWindow: GoogleInfoWindow;
  position: LatLng;
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
      mapId?: string;
    }
  ) => GoogleMap;
  Marker?: new (options: {
    map: GoogleMap;
    position: LatLng;
    title?: string;
  }) => GoogleMarker;
  marker?: {
    AdvancedMarkerElement: new (options: {
      map: GoogleMap;
      position: LatLng;
      title?: string;
    }) => GoogleMarker;
  };
  InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
  LatLngBounds: new () => GoogleLatLngBounds;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: GoogleMaps;
  };
};

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const GOOGLE_MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID";
const DEFAULT_MAP_CENTER: LatLng = { lat: 23.8103, lng: 90.4125 };
const DEFAULT_EVENT_IMAGE = "/images/PET_FAQ.webp";

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
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
        apiKey
      )}&v=weekly&libraries=marker&loading=async`;
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

function getSafeEventImageUrl(event: CommunityEvent): string {
  const rawValue = event.imageUrl?.trim() || "";

  if (!rawValue) {
    return DEFAULT_EVENT_IMAGE;
  }

  if (rawValue.startsWith("/")) {
    return rawValue;
  }

  if (rawValue.startsWith("uploads/")) {
    return `/${rawValue}`;
  }

  if (rawValue.startsWith("http://") || rawValue.startsWith("https://")) {
    return rawValue;
  }

  if (rawValue.startsWith("//")) {
    return `https:${rawValue}`;
  }

  if (rawValue.startsWith("www.")) {
    return `https://${rawValue}`;
  }

  return rawValue;
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

  return `
    <div style="min-width:180px;max-width:220px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <img src="${petImage}" alt="${petName}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;" />
      <div style="margin-top:8px;">
        <div style="font-weight:600;color:#0f172a;">${petName}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${petBreed}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${petType}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">Owner: ${ownerName}</div>
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

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function PublicDiscoverPage() {
  const { data: session, status } = useSession();
  const [pets, setPets] = useState<DiscoverPet[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [eventsError, setEventsError] = useState("");
  const [eventsFeedback, setEventsFeedback] = useState("");
  const [mapError, setMapError] = useState("");
  const [mappedPetCount, setMappedPetCount] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const markerLookupRef = useRef<Record<string, PetMarkerDetails>>({});

  useEffect(() => {
    let isCancelled = false;

    const loadPublicPets = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await fetch("/api/pets/discover", {
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

    void loadPublicPets();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadEvents = async () => {
      setIsLoadingEvents(true);
      setEventsError("");

      try {
        const response = await fetch("/api/events?includePast=true", {
          cache: "no-store",
        });
        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData?.message ?? "Could not fetch events.");
        }

        if (!isCancelled) {
          setEvents(Array.isArray(responseData) ? responseData : []);
        }
      } catch (error) {
        if (!isCancelled) {
          setEventsError(
            error instanceof Error ? error.message : "Could not fetch events."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingEvents(false);
        }
      }
    };

    void loadEvents();

    return () => {
      isCancelled = true;
    };
  }, []);

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

  const focusPetOnMap = (petId: string) => {
    const markerDetails = markerLookupRef.current[petId];
    const map = mapRef.current;

    if (!markerDetails || !map) {
      return;
    }

    map.setCenter(markerDetails.position);
    map.setZoom(14);
    markerDetails.infoWindow.open({ map, anchor: markerDetails.marker });

    mapContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  useEffect(() => {
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
      markerLookupRef.current = {};
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
          mapId: GOOGLE_MAP_ID,
        });
        mapRef.current = map;
        markerLookupRef.current = {};

        const bounds = new maps.LatLngBounds();

        mappablePets.forEach(({ pet, position }) => {
          const marker = maps.marker?.AdvancedMarkerElement
            ? new maps.marker.AdvancedMarkerElement({
                map,
                position,
                title: pet.name || "Pet",
              })
            : maps.Marker
              ? new maps.Marker({
                  map,
                  position,
                  title: pet.name || "Pet",
                })
              : null;

          if (!marker) {
            return;
          }

          const infoWindow = new maps.InfoWindow({
            content: buildInfoContent(pet),
          });

          if (typeof marker.addListener === "function") {
            marker.addListener("click", () => {
              infoWindow.open({ map, anchor: marker });
            });
          }

          markerLookupRef.current[pet._id] = {
            marker,
            infoWindow,
            position,
          };

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
  }, [mappablePets]);

  const joinEvent = async (eventId: string) => {
    if (status !== "authenticated") {
      setEventsFeedback("Login required to participate in community events.");
      return;
    }

    setJoiningEventId(eventId);
    setEventsFeedback("");
    setEventsError("");

    try {
      const response = await fetch("/api/events/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(
          responseData?.message ?? "Could not register for this event."
        );
      }

      if (responseData?.event?._id) {
        const updatedEvent = responseData.event as CommunityEvent;
        setEvents((previous) =>
          previous.map((event) =>
            event._id === updatedEvent._id
              ? { ...event, ...updatedEvent, isParticipating: true }
              : event
          )
        );
      }

      setEventsFeedback(
        typeof responseData?.message === "string"
          ? responseData.message
          : "Participation confirmed."
      );
    } catch (error) {
      setEventsError(
        error instanceof Error ? error.message : "Could not register for event."
      );
    } finally {
      setJoiningEventId(null);
    }
  };

  if (isLoading) {
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

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-700 via-violet-700 to-violet-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
          Public Discover
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Meet Public Pets In The Community
        </h1>
        <p className="mt-2 text-sm text-violet-100/90">
          Click any pet card to instantly focus that pet on the map.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Public Pets</p>
            <p className="text-2xl font-semibold">{pets.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Search Results</p>
            <p className="text-2xl font-semibold">{filteredPets.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Mapped Pets</p>
            <p className="text-2xl font-semibold">{mappedPetCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-violet-50 to-violet-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-600">
              Community Events
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              Join events hosted by Poshik Team
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Participate in local meetups, wellness camps, and adoption drives.
            </p>
          </div>
        </div>

        {eventsFeedback ? (
          <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {eventsFeedback}
          </p>
        ) : null}

        {eventsError ? (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {eventsError}
          </p>
        ) : null}

        {isLoadingEvents ? (
          <p className="mt-4 text-sm text-slate-600">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading community events...
            </span>
          </p>
        ) : events.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-600">
            No upcoming community events yet.
          </p>
        ) : (
          <div className="mt-4 grid items-start gap-3 md:grid-cols-2">
            {events.map((event) => {
              const participantCount = Number(event.participantsCount ?? 0);
              const maxParticipants =
                typeof event.maxParticipants === "number"
                  ? event.maxParticipants
                  : null;
              const isFull =
                maxParticipants !== null && participantCount >= maxParticipants;

              return (
                <article
                  key={event._id}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="grid items-start sm:grid-cols-[220px,minmax(0,1fr)]">
                    <div className="h-44 w-full bg-slate-200 sm:h-52">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getSafeEventImageUrl(event)}
                        alt={event.title || "Community event"}
                        className="h-full w-full object-cover object-center"
                      />
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="text-base font-semibold text-slate-900">
                        {event.title || "Community Event"}
                      </h3>
                      <p className="mt-1 max-h-28 overflow-hidden text-sm leading-relaxed text-slate-600">
                        {event.description || "Join this event and connect with the pet community."}
                      </p>

                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDateTime(event.startAt)}
                        </p>
                        <p className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {event.location || "Location to be announced"}
                        </p>
                        <p className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {participantCount}
                          {maxParticipants !== null ? ` / ${maxParticipants}` : ""}{" "}
                          participants
                        </p>
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        Hosted by {event.hostedBy?.name || "Admin"}
                      </p>

                      <button
                        type="button"
                        onClick={() => void joinEvent(event._id)}
                        disabled={
                          joiningEventId === event._id ||
                          Boolean(event.isParticipating) ||
                          (isFull && !event.isParticipating)
                        }
                        className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-violet-700 to-violet-700 px-3 py-2 text-sm font-semibold text-white transition hover:from-violet-800 hover:to-violet-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {joiningEventId === event._id ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Joining...
                          </>
                        ) : event.isParticipating ? (
                          "Participating"
                        ) : isFull ? (
                          "Event Full"
                        ) : status !== "authenticated" ? (
                          "Login to Participate"
                        ) : (
                          "Participate"
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by pet name, type, breed, or owner..."
            className="w-full rounded-xl border border-slate-300 px-9 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          />
        </label>
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
            No public pets found for your current search.
          </p>
          <p className="text-xs text-slate-500">
            Try a different keyword to discover more pets.
          </p>
        </section>
      ) : null}

      {!errorMessage && filteredPets.length > 0 ? (
        <section className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-slate-900">Pets List</h2>
            <p className="mt-1 text-sm text-slate-600">
              Click a pet from this list to focus its location on the map.
            </p>

            <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1 sm:max-h-[620px]">
              {filteredPets.map((pet) => {
                const canShowOnMap = getPetPosition(pet) !== null;

                return (
                  <button
                    key={pet._id}
                    type="button"
                    disabled={!canShowOnMap}
                    onClick={() => focusPetOnMap(pet._id)}
                    className={`flex w-full items-start gap-3 rounded-xl border border-slate-200 p-3 text-left transition ${
                      canShowOnMap
                        ? "bg-white hover:border-violet-300 hover:bg-violet-50/40"
                        : "cursor-not-allowed bg-slate-50 opacity-80"
                    }`}
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getSafeImageUrl(pet.imageUrl)}
                        alt={pet.name || "Pet"}
                        className="h-full w-full object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {pet.name || "Unnamed pet"}
                        </p>
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                          Public
                        </span>
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        Owner: {getOwnerName(pet)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {pet.type || "-"} • {pet.breed || "Unknown breed"} •{" "}
                        {typeof pet.age === "number" ? `${pet.age} yrs` : "Age -"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        Added: {formatDate(pet.createdAt)}
                      </p>
                      <p
                        className={`mt-1 text-[11px] font-medium ${
                          canShowOnMap ? "text-violet-700" : "text-slate-500"
                        }`}
                      >
                        {canShowOnMap
                          ? "Click to show on map"
                          : "Location unavailable"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-violet-700" />
              <h2 className="text-lg font-semibold text-slate-900">Discover Map</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Map updates focus when you click a pet on the left.
            </p>

            {mapError ? (
              <p className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
                {mapError}
              </p>
            ) : null}

            <div
              ref={mapContainerRef}
              className="mt-3 h-[320px] w-full rounded-xl border border-slate-200 bg-slate-100 sm:h-[420px] lg:h-[620px]"
            />
          </section>
        </section>
      ) : null}

      

      
    </main>
  );
}
