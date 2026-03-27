"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, CheckCircle2, Loader2, UploadCloud } from "lucide-react";

type ProfileData = {
  _id: string;
  name: string;
  email: string;
  role: string;
  kycStatus: string;
  phone: string;
  address: string;
  bio: string;
};

type PetData = {
  _id: string;
  name: string;
  type: string;
  breed: string;
  age: number;
  isPublic: boolean;
  imageUrl: string;
};

type OrderData = {
  _id: string;
  status: string;
  total: number;
  shippingAddress?: string;
  createdAt?: string;
  items: Array<{
    _id?: string;
    name?: string;
    quantity?: number;
    price?: number;
  }>;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type KycData = {
  eligible: boolean;
  role?: string;
  kyc?: {
    _id?: string;
    documentUrl?: string;
    status?: string;
    updatedAt?: string;
    createdAt?: string;
  } | null;
};

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [pageError, setPageError] = useState("");
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [pets, setPets] = useState<PetData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [profileFeedback, setProfileFeedback] = useState<Feedback | null>(null);
  const [petFeedback, setPetFeedback] = useState<Record<string, Feedback>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [savingPetIds, setSavingPetIds] = useState<Record<string, boolean>>({});
  const [uploadingPetIds, setUploadingPetIds] = useState<Record<string, boolean>>(
    {}
  );
  const [kycData, setKycData] = useState<KycData | null>(null);
  const [kycDocumentUrl, setKycDocumentUrl] = useState("");
  const [kycFeedback, setKycFeedback] = useState<Feedback | null>(null);
  const [isUploadingKyc, setIsUploadingKyc] = useState(false);
  const [isSubmittingKyc, setIsSubmittingKyc] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let isCancelled = false;

    const loadData = async () => {
      setIsLoadingData(true);
      setPageError("");

      try {
        const profileResponse = await fetch("/api/users/profile", {
          cache: "no-store",
        });

        if (!profileResponse.ok) {
          throw new Error("Could not fetch profile.");
        }

        const profileData = (await profileResponse.json()) as Partial<ProfileData>;
        const shouldLoadPets = profileData.role !== "ADMIN";

        let petsData: Array<Partial<PetData>> = [];
        if (shouldLoadPets) {
          const petsResponse = await fetch("/api/pets", { cache: "no-store" });

          if (!petsResponse.ok) {
            throw new Error("Could not fetch pets.");
          }

          petsData = (await petsResponse.json()) as Array<Partial<PetData>>;
        }

        if (!isCancelled) {
          setProfile({
            _id: String(profileData._id ?? ""),
            name: profileData.name ?? "",
            email: profileData.email ?? "",
            role: profileData.role ?? "",
            kycStatus: profileData.kycStatus ?? "",
            phone: profileData.phone ?? "",
            address: profileData.address ?? "",
            bio: profileData.bio ?? "",
          });

          setPets(
            Array.isArray(petsData)
              ? petsData.map((pet) => ({
                  _id: String(pet._id ?? ""),
                  name: pet.name ?? "",
                  type: pet.type ?? "",
                  breed: pet.breed ?? "",
                  age:
                    typeof pet.age === "number" ? pet.age : Number(pet.age ?? 0),
                  isPublic:
                    typeof pet.isPublic === "boolean" ? pet.isPublic : true,
                  imageUrl: pet.imageUrl ?? "",
                }))
              : []
          );
        }
      } catch {
        if (!isCancelled) {
          setPageError("Could not load profile data. Please refresh the page.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingData(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [status]);

  const canRender = status === "authenticated" && !!session?.user;

  const fullNameFallback = useMemo(() => {
    const firstName =
      session?.user?.name?.trim().split(" ").filter(Boolean)[0] ?? "User";
    return firstName;
  }, [session?.user?.name]);

  const canUploadKycInProfile =
    profile?.role === "OWNER" || profile?.role === "SHOP";

  const orderSummary = useMemo(
    () => ({
      total: orders.length,
      pending: orders.filter((order) => order.status === "PENDING").length,
      shipped: orders.filter((order) => order.status === "SHIPPED").length,
      delivered: orders.filter((order) => order.status === "DELIVERED").length,
    }),
    [orders]
  );

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    if (!canUploadKycInProfile) {
      setKycData(null);
      setKycDocumentUrl("");
      return;
    }

    let isCancelled = false;

    const loadKycData = async () => {
      try {
        const response = await fetch("/api/auth/kyc", { cache: "no-store" });
        const responseData = (await response.json()) as KycData & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(
            responseData.message ?? "Could not fetch KYC information."
          );
        }

        if (!isCancelled) {
          setKycData(responseData);
          setKycDocumentUrl(responseData.kyc?.documentUrl ?? "");
        }
      } catch (error) {
        if (!isCancelled) {
          setKycFeedback({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not fetch KYC information.",
          });
        }
      }
    };

    void loadKycData();

    return () => {
      isCancelled = true;
    };
  }, [status, canUploadKycInProfile]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let isCancelled = false;

    const loadOrders = async () => {
      setIsLoadingOrders(true);
      setOrdersError("");

      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        const responseData = (await response.json()) as Array<Partial<OrderData>> & {
          message?: string;
        };

        if (!response.ok) {
          throw new Error(
            responseData?.message ?? "Could not fetch order status."
          );
        }

        if (!isCancelled) {
          setOrders(
            Array.isArray(responseData)
              ? responseData.map((order) => ({
                  _id: String(order._id ?? ""),
                  status: String(order.status ?? "PENDING"),
                  total: Number(order.total ?? 0),
                  shippingAddress:
                    typeof order.shippingAddress === "string"
                      ? order.shippingAddress
                      : "",
                  createdAt:
                    typeof order.createdAt === "string"
                      ? order.createdAt
                      : undefined,
                  items: Array.isArray(order.items)
                    ? order.items.map((item) => ({
                        _id: item?._id ? String(item._id) : undefined,
                        name:
                          typeof item?.name === "string" ? item.name : "Item",
                        quantity:
                          typeof item?.quantity === "number"
                            ? item.quantity
                            : Number(item?.quantity ?? 0),
                        price:
                          typeof item?.price === "number"
                            ? item.price
                            : Number(item?.price ?? 0),
                      }))
                    : [],
                }))
              : []
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setOrdersError(
            error instanceof Error
              ? error.message
              : "Could not fetch order status."
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingOrders(false);
        }
      }
    };

    void loadOrders();

    return () => {
      isCancelled = true;
    };
  }, [status]);

  const getOrderStatusStyles = (statusValue: string) => {
    switch (statusValue) {
      case "DELIVERED":
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
      case "CANCELLED":
        return "border-rose-200 bg-rose-50 text-rose-700";
      case "SHIPPED":
      case "PROCESSING":
      case "CONFIRMED":
        return "border-sky-200 bg-sky-50 text-sky-700";
      default:
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
  };

  const formatOrderStatus = (statusValue: string) =>
    statusValue
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const updateProfileField = (
    field: "name" | "phone" | "address" | "bio",
    value: string
  ) => {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updatePetField = (
    petId: string,
    field: keyof Pick<PetData, "name" | "type" | "breed" | "age" | "isPublic" | "imageUrl">,
    value: string | number | boolean
  ) => {
    setPets((prev) =>
      prev.map((pet) => (pet._id === petId ? { ...pet, [field]: value } : pet))
    );
  };

  const saveProfile = async () => {
    if (!profile) {
      return;
    }

    setIsSavingProfile(true);
    setProfileFeedback(null);

    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          phone: profile.phone,
          address: profile.address,
          bio: profile.bio,
        }),
      });

      const responseData = (await response.json()) as Partial<ProfileData> & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(responseData.message ?? "Could not update profile.");
      }

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: responseData.name ?? prev.name,
              phone: responseData.phone ?? prev.phone,
              address: responseData.address ?? prev.address,
              bio: responseData.bio ?? prev.bio,
            }
          : prev
      );

      await update({ name: responseData.name ?? profile.name });

      setProfileFeedback({
        type: "success",
        message: "Profile details updated successfully.",
      });
    } catch (error) {
      setProfileFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update profile. Please try again.",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const savePet = async (
    petId: string,
    successMessage = "Pet details updated.",
    petOverride?: PetData
  ) => {
    const pet = petOverride ?? pets.find((item) => item._id === petId);
    if (!pet) {
      return;
    }

    setSavingPetIds((prev) => ({ ...prev, [petId]: true }));
    setPetFeedback((prev) => {
      const next = { ...prev };
      delete next[petId];
      return next;
    });

    try {
      const response = await fetch(`/api/pets/${petId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: pet.name,
          type: pet.type,
          breed: pet.breed,
          age: pet.age,
          isPublic: pet.isPublic,
          imageUrl: pet.imageUrl,
        }),
      });

      const responseData = (await response.json()) as Partial<PetData> & {
        message?: string;
      };

      if (!response.ok) {
        throw new Error(responseData.message ?? "Could not update pet.");
      }

      setPets((prev) =>
        prev.map((item) =>
          item._id === petId
            ? {
                ...item,
                name: responseData.name ?? item.name,
                type: responseData.type ?? item.type,
                breed: responseData.breed ?? item.breed,
                age:
                  typeof responseData.age === "number"
                    ? responseData.age
                    : item.age,
                isPublic:
                  typeof responseData.isPublic === "boolean"
                    ? responseData.isPublic
                    : item.isPublic,
                imageUrl: responseData.imageUrl ?? item.imageUrl,
              }
            : item
        )
      );

      setPetFeedback((prev) => ({
        ...prev,
        [petId]: { type: "success", message: successMessage },
      }));
    } catch (error) {
      setPetFeedback((prev) => ({
        ...prev,
        [petId]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not update pet. Please try again.",
        },
      }));
    } finally {
      setSavingPetIds((prev) => ({ ...prev, [petId]: false }));
    }
  };

  const uploadPetImage = async (petId: string, file: File) => {
    setUploadingPetIds((prev) => ({ ...prev, [petId]: true }));
    setPetFeedback((prev) => {
      const next = { ...prev };
      delete next[petId];
      return next;
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const responseData = (await response.json()) as {
        url?: string;
        message?: string;
      };

      if (!response.ok || !responseData.url) {
        throw new Error(responseData.message ?? "Could not upload pet image.");
      }

      setPets((prev) =>
        prev.map((pet) =>
          pet._id === petId ? { ...pet, imageUrl: responseData.url! } : pet
        )
      );

      const petWithNewImage = pets.find((pet) => pet._id === petId);
      if (petWithNewImage) {
        await savePet(petId, "Pet image uploaded and details saved.", {
          ...petWithNewImage,
          imageUrl: responseData.url,
        });
      }
    } catch (error) {
      setPetFeedback((prev) => ({
        ...prev,
        [petId]: {
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Could not upload pet image.",
        },
      }));
    } finally {
      setUploadingPetIds((prev) => ({ ...prev, [petId]: false }));
    }
  };

  const uploadKycDocument = async (file: File) => {
    setKycFeedback(null);
    setIsUploadingKyc(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/kyc/upload", {
        method: "POST",
        body: formData,
      });

      const responseData = (await response.json()) as {
        url?: string;
        message?: string;
      };

      if (!response.ok || !responseData.url) {
        throw new Error(responseData.message ?? "Could not upload KYC document.");
      }

      setKycDocumentUrl(responseData.url);
      setKycFeedback({
        type: "success",
        message: "KYC document uploaded. Click submit to complete verification.",
      });
    } catch (error) {
      setKycFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not upload KYC document.",
      });
    } finally {
      setIsUploadingKyc(false);
    }
  };

  const submitKyc = async () => {
    const documentUrl = kycDocumentUrl.trim();
    if (!documentUrl) {
      setKycFeedback({
        type: "error",
        message: "Please upload a document first.",
      });
      return;
    }

    setKycFeedback(null);
    setIsSubmittingKyc(true);

    try {
      const response = await fetch("/api/auth/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl }),
      });

      const responseData = (await response.json()) as {
        message?: string;
        kyc?: {
          documentUrl?: string;
          status?: string;
          updatedAt?: string;
          createdAt?: string;
          _id?: string;
        };
      };

      if (!response.ok) {
        throw new Error(responseData.message ?? "Could not submit KYC.");
      }

      setKycData((prev) => ({
        eligible: true,
        role: prev?.role ?? profile?.role ?? "",
        kyc: responseData.kyc ?? prev?.kyc ?? null,
      }));

      if (responseData.kyc?.status) {
        setProfile((prev) =>
          prev ? { ...prev, kycStatus: responseData.kyc?.status ?? prev.kycStatus } : prev
        );
      }

      setKycDocumentUrl(responseData.kyc?.documentUrl ?? documentUrl);
      setKycFeedback({
        type: "success",
        message: responseData.message ?? "KYC submitted successfully.",
      });
    } catch (error) {
      setKycFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not submit KYC.",
      });
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  if (status === "loading") {
    return (
      <section className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-600">Loading profile...</p>
      </section>
    );
  }

  if (!canRender) {
    return null;
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 px-6 py-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50">
          Profile Center
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          {fullNameFallback}, manage your account and pet details
        </h1>
        <p className="mt-2 text-sm text-emerald-50/90">
          Update your profile info, edit pet details, and upload pet images.
        </p>
      </section>

      {pageError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {pageError}
        </div>
      ) : null}

      {isLoadingData ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading profile data...
        </div>
      ) : (
        <div
          className={`grid gap-6 ${
            profile?.role === "ADMIN" ? "" : "xl:grid-cols-[1fr,1.2fr]"
          }`}
        >
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Profile Details
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Keep your account information updated.
            </p>

            {profile ? (
              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Name
                  </label>
                  <input
                    value={profile.name}
                    onChange={(event) =>
                      updateProfileField("name", event.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Email
                  </label>
                  <input
                    value={profile.email}
                    disabled
                    className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Phone
                    </label>
                    <input
                      value={profile.phone}
                      onChange={(event) =>
                        updateProfileField("phone", event.target.value)
                      }
                      placeholder="+8801..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <input
                      value={profile.address}
                      onChange={(event) =>
                        updateProfileField("address", event.target.value)
                      }
                      placeholder="City, Area"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Bio
                  </label>
                  <textarea
                    value={profile.bio}
                    onChange={(event) =>
                      updateProfileField("bio", event.target.value)
                    }
                    placeholder="Tell others about you and your pets..."
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    Role: <span className="font-semibold">{profile.role}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    KYC Status:{" "}
                    <span className="font-semibold">{profile.kycStatus}</span>
                  </div>
                </div>

                {canUploadKycInProfile ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        KYC Document
                      </h3>
                      <p className="text-xs text-slate-600">
                        Upload your KYC file (PDF/JPG/PNG/WEBP) and submit for
                        verification.
                      </p>
                    </div>

                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                      {isUploadingKyc ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <UploadCloud className="h-3.5 w-3.5" />
                      )}
                      {isUploadingKyc ? "Uploading..." : "Upload KYC Document"}
                      <input
                        type="file"
                        accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                        className="hidden"
                        disabled={isUploadingKyc || isSubmittingKyc}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadKycDocument(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>

                    <input
                      value={kycDocumentUrl}
                      onChange={(event) => setKycDocumentUrl(event.target.value)}
                      placeholder="KYC document URL will appear here"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    />

                    {kycData?.kyc?.documentUrl ? (
                      <a
                        href={kycData.kyc.documentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs font-medium text-emerald-700 underline"
                      >
                        View current uploaded KYC document
                      </a>
                    ) : null}

                    {kycData?.kyc?.updatedAt ? (
                      <p className="text-xs text-slate-500">
                        Last updated:{" "}
                        {new Date(kycData.kyc.updatedAt).toLocaleString()}
                      </p>
                    ) : null}

                    {kycFeedback ? (
                      <div
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                          kycFeedback.type === "success"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-rose-200 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {kycFeedback.type === "success" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        )}
                        <p>{kycFeedback.message}</p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={submitKyc}
                      disabled={isUploadingKyc || isSubmittingKyc}
                      className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmittingKyc ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting KYC...
                        </>
                      ) : (
                        "Submit KYC"
                      )}
                    </button>
                  </div>
                ) : null}

                {profileFeedback ? (
                  <div
                    className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                      profileFeedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-rose-200 bg-rose-50 text-rose-700"
                    }`}
                  >
                    {profileFeedback.type === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <p>{profileFeedback.message}</p>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={isSavingProfile}
                  className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-700 to-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:from-emerald-800 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSavingProfile ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving Profile...
                    </>
                  ) : (
                    "Save Profile Details"
                  )}
                </button>
              </div>
            ) : null}
          </section>

          {profile?.role !== "ADMIN" ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your Pets</h2>
            <p className="mt-1 text-sm text-slate-600">
              Edit pet details and upload pet images.
            </p>

            {pets.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                No pets found yet. Add a pet from your owner dashboard first.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {pets.map((pet) => {
                  const isSaving = !!savingPetIds[pet._id];
                  const isUploading = !!uploadingPetIds[pet._id];
                  const feedback = petFeedback[pet._id];

                  return (
                    <article
                      key={pet._id}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div className="grid gap-4 sm:grid-cols-[140px,1fr]">
                        <div>
                          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <Image
                              src={
                                pet.imageUrl?.trim() || "/images/default-pet.png"
                              }
                              alt={`${pet.name} image`}
                              width={320}
                              height={256}
                              className="h-32 w-full object-cover"
                            />
                          </div>
                          <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
                            {isUploading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <UploadCloud className="h-3.5 w-3.5" />
                            )}
                            {isUploading ? "Uploading..." : "Upload Image"}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp"
                              className="hidden"
                              disabled={isUploading || isSaving}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  void uploadPetImage(pet._id, file);
                                }
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                              Name
                            </label>
                            <input
                              value={pet.name}
                              onChange={(event) =>
                                updatePetField(pet._id, "name", event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                              Type
                            </label>
                            <input
                              value={pet.type}
                              onChange={(event) =>
                                updatePetField(pet._id, "type", event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                              Breed
                            </label>
                            <input
                              value={pet.breed}
                              onChange={(event) =>
                                updatePetField(pet._id, "breed", event.target.value)
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                              Age
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={pet.age}
                              onChange={(event) =>
                                updatePetField(
                                  pet._id,
                                  "age",
                                  Number(event.target.value)
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                            />
                          </div>

                          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={pet.isPublic}
                              onChange={(event) =>
                                updatePetField(
                                  pet._id,
                                  "isPublic",
                                  event.target.checked
                                )
                              }
                              className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                            />
                            Show this pet on public discovery map
                          </label>
                        </div>
                      </div>

                      {feedback ? (
                        <div
                          className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
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

                      <button
                        type="button"
                        onClick={() => savePet(pet._id)}
                        disabled={isSaving || isUploading}
                        className="mt-3 flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Pet Details"
                        )}
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
            </section>
          ) : null}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Order Status</h2>
        <p className="mt-1 text-sm text-slate-600">
          Track your latest order progress from your profile.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">Total Orders</p>
            <p className="text-xl font-semibold text-slate-900">
              {orderSummary.total}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">Pending</p>
            <p className="text-xl font-semibold text-amber-800">
              {orderSummary.pending}
            </p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
            <p className="text-xs text-sky-700">Shipped</p>
            <p className="text-xl font-semibold text-sky-800">
              {orderSummary.shipped}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="text-xs text-emerald-700">Delivered</p>
            <p className="text-xl font-semibold text-emerald-800">
              {orderSummary.delivered}
            </p>
          </div>
        </div>

        {isLoadingOrders ? (
          <p className="mt-4 text-sm text-slate-600">Loading order status...</p>
        ) : ordersError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {ordersError}
          </div>
        ) : orders.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">
            No orders found for your account yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {orders.slice(0, 6).map((order) => (
              <article
                key={order._id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Order #{order._id.slice(-8).toUpperCase()}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Placed:{" "}
                      {order.createdAt
                        ? new Date(order.createdAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      ₹{Number(order.total ?? 0).toFixed(2)}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getOrderStatusStyles(
                        order.status
                      )}`}
                    >
                      {formatOrderStatus(order.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {order.items.slice(0, 3).map((item, index) => (
                    <p key={item._id ?? `${order._id}-${index}`}>
                      {item.name ?? "Item"} x {Number(item.quantity ?? 0)} = ₹
                      {(Number(item.price ?? 0) * Number(item.quantity ?? 0)).toFixed(
                        2
                      )}
                    </p>
                  ))}
                  {order.items.length > 3 ? (
                    <p className="text-slate-500">
                      +{order.items.length - 3} more items
                    </p>
                  ) : null}
                </div>

                {order.shippingAddress ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Delivery Address: {order.shippingAddress}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Go Home
          </button>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white transition hover:bg-slate-700"
          >
            Logout
          </button>
        </div>
      </section>
    </main>
  );
}
