"use client";

import { useEffect, useRef, useState } from "react";

type LatLng = {
  lat: number;
  lng: number;
};

type MapPet = {
  _id: string;
  name: string;
  type?: string;
  breed?: string;
  imageUrl?: string;
  location?: {
    type: "Point";
    coordinates: number[];
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

        existingScript.addEventListener("load", () => resolve(), {
          once: true,
        });
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

function getPetPosition(pet: MapPet): LatLng | null {
  const coordinates = pet.location?.coordinates;
  if (!coordinates || coordinates.length < 2) {
    return null;
  }

  const lng = Number(coordinates[0]);
  const lat = Number(coordinates[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return null;
  }

  return { lat, lng };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSafeImageUrl(url?: string): string {
  if (!url) {
    return "/images/default-pet.png";
  }

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

function buildInfoContent(pet: MapPet): string {
  const petName = escapeHtml(pet.name || "Pet");
  const petBreed = pet.breed ? escapeHtml(pet.breed) : "Unknown breed";
  const petType = pet.type ? escapeHtml(pet.type) : "Unknown type";
  const petImageUrl = escapeHtml(getSafeImageUrl(pet.imageUrl));

  return `
    <div style="min-width:180px;max-width:220px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
      <img src="${petImageUrl}" alt="${petName}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;" />
      <div style="margin-top:8px;">
        <div style="font-weight:600;color:#0f172a;">${petName}</div>
        <div style="font-size:12px;color:#475569;margin-top:2px;">${petBreed}</div>
        <div style="font-size:12px;color:#64748b;margin-top:2px;">${petType}</div>
      </div>
    </div>
  `;
}

type PetMapProps = {
  refreshKey?: number;
};

export default function PetMap({ refreshKey = 0 }: PetMapProps) {
  const [pets, setPets] = useState<MapPet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState("");
  const [mapError, setMapError] = useState("");
  const [petsError, setPetsError] = useState("");
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<GoogleMap | null>(null);
  const petMarkerLookupRef = useRef<Record<string, PetMarkerDetails>>({});

  const focusPetOnMap = (petId: string) => {
    const markerDetails = petMarkerLookupRef.current[petId];
    const map = mapRef.current;

    if (!markerDetails || !map) {
      return;
    }

    map.setCenter(markerDetails.position);
    map.setZoom(14);
    markerDetails.infoWindow.open({
      map,
      anchor: markerDetails.marker,
    });

    mapContainerRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  };

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setPetsError("");
    setLocationError("");

    const loadAllPets = async () => {
      try {
        const response = await fetch("/api/pets/nearby?all=true", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Could not fetch pets.");
        }

        const data: unknown = await response.json();
        if (!isCancelled) {
          setPets(Array.isArray(data) ? (data as MapPet[]) : []);
        }
      } catch {
        if (!isCancelled) {
          setPetsError("Could not load pets for map right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    const resolveUserLocation = () => {
      if (!navigator.geolocation) {
        setLocationError(
          "Geolocation is not supported. Showing all public pets on the map."
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isCancelled) {
            return;
          }

          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          if (!isCancelled) {
            setLocationError(
              "Location access denied. Showing all public pets instead."
            );
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    };

    resolveUserLocation();
    void loadAllPets();

    return () => {
      isCancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      setMapError(
        "Google Maps API key is missing. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local."
      );
      return;
    }

    let isCancelled = false;
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

        const initialCenter =
          userLocation ?? getPetPosition(pets[0]) ?? DEFAULT_MAP_CENTER;

        const map = new maps.Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: userLocation ? 11 : 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });
        mapRef.current = map;
        petMarkerLookupRef.current = {};

        const bounds = new maps.LatLngBounds();
        let markersCount = 0;

        if (userLocation) {
          new maps.Marker({
            map,
            position: userLocation,
            title: "Your location",
          });
          bounds.extend(userLocation);
          markersCount += 1;
        }

        pets.forEach((pet) => {
          const position = getPetPosition(pet);
          if (!position) {
            return;
          }

          markersCount += 1;
          const marker = new maps.Marker({
            map,
            position,
            title: `${pet.name}${pet.breed ? ` (${pet.breed})` : ""}`,
          });
          const infoWindow = new maps.InfoWindow({
            content: buildInfoContent(pet),
          });
          marker.addListener("click", () => {
            infoWindow.open({ map, anchor: marker });
          });
          petMarkerLookupRef.current[pet._id] = {
            marker,
            infoWindow,
            position,
          };
          bounds.extend(position);
        });

        if (markersCount > 1) {
          map.fitBounds(bounds);
        } else {
          map.setCenter(initialCenter);
          map.setZoom(userLocation ? 11 : 6);
        }
      } catch {
        if (!isCancelled) {
          setMapError("Could not load Google Map. Please try again.");
        }
      }
    };

    renderMap();

    return () => {
      isCancelled = true;
    };
  }, [pets, userLocation]);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-slate-900">All Public Pets Map</h3>

      {locationError ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
          {locationError}
        </p>
      ) : null}

      {mapError ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
          {mapError}
        </p>
      ) : null}

      <div
        ref={mapContainerRef}
        className="h-[320px] w-full rounded-xl border border-slate-200 bg-slate-100 sm:h-[420px]"
      />

      {isLoading ? (
        <p className="text-sm text-slate-600">Loading pets for map...</p>
      ) : null}

      {petsError ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
          {petsError}
        </p>
      ) : null}

      {!isLoading && !petsError && pets.length === 0 ? (
        <p className="text-sm text-slate-600">
          No public pets found to display on the map.
        </p>
      ) : null}

      {pets.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-medium text-slate-700">
            Public pets on map: {pets.length}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {pets.map((pet) => (
              <div
                key={pet._id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => focusPetOnMap(pet._id)}
                  className="shrink-0 rounded-md transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  aria-label={`Show ${pet.name} location on map`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSafeImageUrl(pet.imageUrl)}
                    alt={`${pet.name} thumbnail`}
                    className="h-10 w-10 rounded-md border border-slate-200 object-cover"
                  />
                </button>
                <div className="text-sm text-slate-700">
                  <p className="font-medium text-slate-800">{pet.name}</p>
                  <p className="text-xs text-slate-500">
                    {pet.breed ?? "Unknown breed"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
