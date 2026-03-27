"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PawPrint,
  UploadCloud,
} from "lucide-react";

type PetFormProps = {
  ownerId: string;
  onPetCreated?: () => void;
};

const initialFormState = {
  name: "",
  type: "",
  breed: "",
  age: 1,
};

const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export default function PetForm({ ownerId, onPetCreated }: PetFormProps) {
  const [form, setForm] = useState({
    ...initialFormState,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (previewImageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewImageUrl);
      }
    };
  }, [previewImageUrl]);

  const setField = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearSelectedImage = () => {
    setSelectedImageFile(null);
    setPreviewImageUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      clearSelectedImage();
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setIsError(true);
      setStatusMessage("Only JPG, PNG, and WEBP images are allowed.");
      clearSelectedImage();
      return;
    }

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setIsError(true);
      setStatusMessage("Image must be 5MB or smaller.");
      clearSelectedImage();
      return;
    }

    setIsError(false);
    setStatusMessage("");
    setSelectedImageFile(file);
    setPreviewImageUrl(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setStatusMessage("");
    setIsError(false);

    if (!ownerId) {
      setIsError(true);
      setStatusMessage("Unable to identify owner profile. Please log in again.");
      return;
    }

    if (!form.name.trim() || !form.type.trim() || !form.breed.trim()) {
      setIsError(true);
      setStatusMessage("Name, type, and breed are required.");
      return;
    }

    if (!navigator.geolocation) {
      setIsError(true);
      setStatusMessage("Geolocation is not supported in this browser.");
      return;
    }

    setIsSubmitting(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          let uploadedImageUrl = "";

          if (selectedImageFile) {
            setIsUploadingImage(true);
            const imageFormData = new FormData();
            imageFormData.append("file", selectedImageFile);

            const uploadResponse = await fetch("/api/upload", {
              method: "POST",
              body: imageFormData,
            });

            const uploadPayload: { message?: string; url?: string } | null =
              await uploadResponse.json().catch(() => null);

            if (!uploadResponse.ok || !uploadPayload?.url) {
              throw new Error(
                uploadPayload?.message || "Could not upload pet image."
              );
            }

            uploadedImageUrl = uploadPayload.url;
          }

          const response = await fetch("/api/pets", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...form,
              ownerId,
              location: {
                type: "Point",
                coordinates: [pos.coords.longitude, pos.coords.latitude],
              },
              imageUrl: uploadedImageUrl,
            }),
          });

          if (!response.ok) {
            throw new Error("Could not create pet profile.");
          }

          setForm({ ...initialFormState });
          clearSelectedImage();
          setStatusMessage("Pet profile created successfully.");
          onPetCreated?.();
        } catch (error) {
          setIsError(true);
          setStatusMessage(
            error instanceof Error && error.message
              ? error.message
              : "Could not create pet profile. Please try again."
          );
        } finally {
          setIsUploadingImage(false);
          setIsSubmitting(false);
        }
      },
      () => {
        setIsUploadingImage(false);
        setIsSubmitting(false);
        setIsError(true);
        setStatusMessage(
          "Location access is required to add your pet to nearby discovery."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
          <PawPrint className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Add a New Pet
          </h2>
          <p className="text-sm text-slate-600">
            Create a profile so your pet appears in your dashboard and nearby
            map discovery.
          </p>
        </div>
      </div>

      {statusMessage ? (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
            isError
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {isError ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{statusMessage}</p>
        </div>
      ) : null}

      <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="pet-name" className="text-sm font-medium text-slate-700">
            Pet Name
          </label>
          <input
            id="pet-name"
            value={form.name}
            placeholder="Buddy"
            onChange={(e) => setField("name", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pet-type" className="text-sm font-medium text-slate-700">
            Pet Type
          </label>
          <input
            id="pet-type"
            value={form.type}
            placeholder="Dog"
            onChange={(e) => setField("type", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pet-breed" className="text-sm font-medium text-slate-700">
            Breed
          </label>
          <input
            id="pet-breed"
            value={form.breed}
            placeholder="Golden Retriever"
            onChange={(e) => setField("breed", e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="pet-age" className="text-sm font-medium text-slate-700">
            Age (Years)
          </label>
          <input
            id="pet-age"
            type="number"
            min={0}
            value={form.age}
            onChange={(e) => setField("age", Number(e.target.value))}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="pet-image" className="text-sm font-medium text-slate-700">
            Pet Image (Optional)
          </label>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
            <label
              htmlFor="pet-image"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              <UploadCloud className="h-4 w-4" />
              {selectedImageFile ? "Change image" : "Upload image"}
            </label>
            <input
              ref={fileInputRef}
              id="pet-image"
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleImageChange}
              className="sr-only"
            />
            <p className="mt-2 text-xs text-slate-500">
              JPG, PNG, and WEBP only. Max size 5MB.
            </p>

            {selectedImageFile ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
                <div
                  className="h-14 w-14 rounded-lg border border-slate-200 bg-cover bg-center"
                  style={{ backgroundImage: `url('${previewImageUrl}')` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">
                    {selectedImageFile.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {(selectedImageFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:from-emerald-800 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploadingImage ? "Uploading Image..." : "Creating Pet..."}
              </>
            ) : (
              "Add Pet Profile"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}
