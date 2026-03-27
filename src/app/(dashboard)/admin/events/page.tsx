"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MapPin,
  UploadCloud,
} from "lucide-react";

type EventItem = {
  _id: string;
  title: string;
  description: string;
  location: string;
  imageUrl?: string;
  startAt: string;
  isActive?: boolean;
  maxParticipants?: number | null;
  participantsCount?: number;
  hostedBy?: {
    _id?: string;
    name?: string;
    role?: string;
  } | null;
};

type Feedback = {
  type: "success" | "error";
  message: string;
};

type EventDraft = {
  title: string;
  description: string;
  location: string;
  imageUrl: string;
  startAt: string;
  maxParticipants: string;
};

type EventFormMode = "create" | "edit";

const defaultDraft: EventDraft = {
  title: "",
  description: "",
  location: "",
  imageUrl: "",
  startAt: "",
  maxParticipants: "",
};

function formatDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function toDatetimeLocalValue(value?: string): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const timezoneOffset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
}

export default function AdminEventsPage() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [draft, setDraft] = useState<EventDraft>(defaultDraft);
  const [formMode, setFormMode] = useState<EventFormMode>("create");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const role = session?.user?.role;

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        "/api/events?includePast=true&includeInactive=true",
        {
        cache: "no-store",
        }
      );
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch events.");
      }
      setEvents(Array.isArray(responseData) ? responseData : []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not fetch events.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }
    if (role !== "ADMIN") {
      return;
    }

    void loadEvents();
  }, [status, role, loadEvents]);

  const resetForm = () => {
    setFormMode("create");
    setEditingEventId(null);
    setDraft(defaultDraft);
  };

  const startEditingEvent = (eventItem: EventItem) => {
    setFormMode("edit");
    setEditingEventId(eventItem._id);
    setDraft({
      title: eventItem.title ?? "",
      description: eventItem.description ?? "",
      location: eventItem.location ?? "",
      imageUrl: eventItem.imageUrl ?? "",
      startAt: toDatetimeLocalValue(eventItem.startAt),
      maxParticipants:
        typeof eventItem.maxParticipants === "number"
          ? String(eventItem.maxParticipants)
          : "",
    });
    setFeedback(null);
  };

  const submitEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (!draft.imageUrl.trim()) {
        throw new Error("Event image URL is required.");
      }

      const payload = {
        title: draft.title,
        description: draft.description,
        location: draft.location,
        imageUrl: draft.imageUrl.trim(),
        startAt: draft.startAt,
        maxParticipants: draft.maxParticipants
          ? Number(draft.maxParticipants)
          : null,
      };

      const endpoint =
        formMode === "edit" && editingEventId
          ? `/api/events/${editingEventId}`
          : "/api/events";

      const response = await fetch(endpoint, {
        method: formMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not create event.");
      }

      resetForm();
      setFeedback({
        type: "success",
        message:
          formMode === "edit"
            ? "Event updated successfully."
            : "Community event hosted successfully.",
      });
      await loadEvents();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not create event.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteEvent = async (eventItem: EventItem) => {
    const confirmed = window.confirm(
      `Delete event "${eventItem.title}"? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setDeletingEventId(eventItem._id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/events/${eventItem._id}`, {
        method: "DELETE",
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not delete event.");
      }

      if (editingEventId === eventItem._id) {
        resetForm();
      }

      setFeedback({
        type: "success",
        message: "Event deleted successfully.",
      });
      await loadEvents();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not delete event.",
      });
    } finally {
      setDeletingEventId(null);
    }
  };

  const uploadEventImage = async (file: File) => {
    setIsUploadingImage(true);
    setFeedback(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const responseData = await response.json();

      if (!response.ok || typeof responseData?.url !== "string") {
        throw new Error(responseData?.message ?? "Could not upload event image.");
      }

      const uploadedUrl = responseData.url.trim();

      setDraft((previous) => ({ ...previous, imageUrl: uploadedUrl }));

      if (formMode === "edit" && editingEventId) {
        const saveResponse = await fetch(`/api/events/${editingEventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: uploadedUrl }),
        });
        const saveData = await saveResponse.json();

        if (!saveResponse.ok) {
          throw new Error(saveData?.message ?? "Could not save event image.");
        }

        setEvents((previous) =>
          previous.map((eventItem) =>
            eventItem._id === editingEventId
              ? { ...eventItem, imageUrl: saveData?.imageUrl ?? uploadedUrl }
              : eventItem
          )
        );
        setFeedback({
          type: "success",
          message: "Event image uploaded and saved.",
        });
      } else {
        setFeedback({
          type: "success",
          message: "Event image uploaded. You can now host this event.",
        });
      }
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not upload event image.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const toggleEventStatus = async (eventItem: EventItem) => {
    setUpdatingEventId(eventItem._id);
    setFeedback(null);
    try {
      const response = await fetch(`/api/events/${eventItem._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !eventItem.isActive }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not update event.");
      }

      setFeedback({
        type: "success",
        message: responseData?.isActive
          ? "Event is now active."
          : "Event has been archived.",
      });
      await loadEvents();
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not update event.",
      });
    } finally {
      setUpdatingEventId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading event management...
        </div>
      </div>
    );
  }

  if (!session || role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Only admin can host and manage community events.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-violet-200 bg-gradient-to-r from-violet-700 via-indigo-700 to-sky-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
          Admin Events
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Host community events for all users
        </h1>
        <p className="mt-2 text-sm text-violet-100/90">
          Create events and keep your community engaged directly from admin.
        </p>
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
        <h2 className="text-lg font-semibold text-slate-900">
          {formMode === "edit" ? "Edit Existing Event" : "Host New Event"}
        </h2>
        <form className="mt-4 space-y-3" onSubmit={submitEvent}>
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, title: event.target.value }))
            }
            placeholder="Event title"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          />
          <textarea
            value={draft.description}
            onChange={(event) =>
              setDraft((previous) => ({
                ...previous,
                description: event.target.value,
              }))
            }
            rows={3}
            placeholder="Event description"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={draft.location}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  location: event.target.value,
                }))
              }
              placeholder="Location"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <input
              value={draft.imageUrl}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  imageUrl: event.target.value,
                }))
              }
              placeholder="Event image URL"
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <input
              type="datetime-local"
              value={draft.startAt}
              onChange={(event) =>
                setDraft((previous) => ({ ...previous, startAt: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              type="number"
              min={1}
              value={draft.maxParticipants}
              onChange={(event) =>
                setDraft((previous) => ({
                  ...previous,
                  maxParticipants: event.target.value,
                }))
              }
              placeholder="Max participants (optional)"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            />
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              {isUploadingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {isUploadingImage ? "Uploading..." : "Upload Image"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                disabled={isUploadingImage || isSubmitting}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void uploadEventImage(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>

          {draft.imageUrl ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.imageUrl}
                alt="Event preview"
                className="h-48 w-full object-cover"
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting || isUploadingImage}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:from-violet-800 hover:to-indigo-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : formMode === "edit" ? (
              "Save Event Changes"
            ) : (
              "Host Event"
            )}
          </button>
          {formMode === "edit" ? (
            <button
              type="button"
              onClick={resetForm}
              className="ml-2 inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancel Edit
            </button>
          ) : null}
        </form>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Hosted Events (Active + Archived)
        </h2>
        {isLoading ? (
          <p className="mt-3 text-sm text-slate-600">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No events hosted yet.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {events.map((eventItem) => (
              <article
                key={eventItem._id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                {eventItem.imageUrl ? (
                  <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={eventItem.imageUrl}
                      alt={eventItem.title}
                      className="h-44 w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {eventItem.title}
                    </h3>
                    <span
                      className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        eventItem.isActive
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 bg-slate-100 text-slate-600"
                      }`}
                    >
                      {eventItem.isActive ? "Active" : "Archived"}
                    </span>
                    <p className="mt-1 text-sm text-slate-600">
                      {eventItem.description}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <p className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {eventItem.location}
                      </p>
                      <p className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateTime(eventItem.startAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-slate-500">Participants</p>
                    <p className="text-xl font-semibold text-slate-900">
                      {eventItem.participantsCount ?? 0}
                      {typeof eventItem.maxParticipants === "number"
                        ? ` / ${eventItem.maxParticipants}`
                        : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingEvent(eventItem)}
                        className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleEventStatus(eventItem)}
                        disabled={updatingEventId === eventItem._id}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                          eventItem.isActive
                            ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        } disabled:cursor-not-allowed disabled:opacity-70`}
                      >
                        {updatingEventId === eventItem._id
                          ? "Updating..."
                          : eventItem.isActive
                            ? "Archive"
                            : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteEvent(eventItem)}
                        disabled={deletingEventId === eventItem._id}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {deletingEventId === eventItem._id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
