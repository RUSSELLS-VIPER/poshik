"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";

type DoctorItem = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  bio?: string;
};

type PetItem = {
  _id: string;
  name?: string;
  type?: string;
  breed?: string;
  imageUrl?: string;
};

type AppointmentItem = {
  _id: string;
  date: string;
  time: string;
  notes?: string;
  status: string;
  doctorId?: {
    _id?: string;
    name?: string;
    email?: string;
  };
  petId?: {
    _id?: string;
    name?: string;
    type?: string;
    breed?: string;
    imageUrl?: string;
  };
};

type BookingFormState = {
  doctorId: string;
  petId: string;
  date: string;
  time: string;
  notes: string;
};

const defaultBookingForm: BookingFormState = {
  doctorId: "",
  petId: "",
  date: "",
  time: "",
  notes: "",
};

export default function OwnerAppointmentBooking() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [pets, setPets] = useState<PetItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [form, setForm] = useState<BookingFormState>(defaultBookingForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const canBook = role === "OWNER" || role === "ADMIN";
  const upcomingAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.status !== "CANCELLED"),
    [appointments]
  );

  const loadData = useCallback(async () => {
    if (!canBook) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const [doctorsRes, petsRes, appointmentsRes] = await Promise.all([
        fetch("/api/doctors", { cache: "no-store" }),
        fetch("/api/pets", { cache: "no-store" }),
        fetch("/api/appointments", { cache: "no-store" }),
      ]);

      const doctorsData = await doctorsRes.json();
      const petsData = await petsRes.json();
      const appointmentsData = await appointmentsRes.json();

      if (!doctorsRes.ok) {
        throw new Error(doctorsData?.message ?? "Could not fetch doctors.");
      }
      if (!petsRes.ok) {
        throw new Error(petsData?.message ?? "Could not fetch pets.");
      }
      if (!appointmentsRes.ok) {
        throw new Error(
          appointmentsData?.message ?? "Could not fetch appointments."
        );
      }

      setDoctors(Array.isArray(doctorsData) ? doctorsData : []);
      setPets(Array.isArray(petsData) ? petsData : []);
      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not load appointment data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [canBook]);

  useEffect(() => {
    if (status === "authenticated") {
      void loadData();
    } else if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, loadData]);

  const onBookAppointment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not create appointment.");
      }

      setForm(defaultBookingForm);
      setAppointments((previous) => [responseData, ...previous]);
      setFeedback({ type: "success", message: "Appointment booked successfully." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error ? error.message : "Could not book appointment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCancelAppointment = async (appointmentId: string) => {
    setUpdatingAppointmentId(appointmentId);
    setFeedback(null);

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not cancel appointment.");
      }

      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment._id === appointmentId
            ? { ...appointment, status: responseData.status }
            : appointment
        )
      );
      setFeedback({ type: "success", message: "Appointment cancelled." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not cancel appointment.",
      });
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading doctor appointments...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          Login as pet owner to book appointments.
        </div>
      </div>
    );
  }

  if (!canBook) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800 shadow-sm">
          This booking view is available for pet owners.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-700 via-sky-700 to-cyan-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
          Pet Owner
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Book vet appointments
        </h1>
        <p className="mt-2 text-sm text-sky-100/90">
          Choose doctor, pet, date, and time to schedule your visit.
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

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-indigo-700" />
            <h2 className="text-lg font-semibold text-slate-900">New Appointment</h2>
          </div>

          <form className="space-y-3" onSubmit={onBookAppointment}>
            <select
              value={form.doctorId}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, doctorId: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              required
            >
              <option value="">Select doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name || doctor.email || doctor._id}
                </option>
              ))}
            </select>

            <select
              value={form.petId}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, petId: event.target.value }))
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              required
            >
              <option value="">Select pet</option>
              {pets.map((pet) => (
                <option key={pet._id} value={pet._id}>
                  {pet.name || "Unnamed pet"} ({pet.type || "Pet"})
                </option>
              ))}
            </select>

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, date: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                required
              />
              <input
                type="time"
                value={form.time}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, time: event.target.value }))
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                required
              />
            </div>

            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, notes: event.target.value }))
              }
              rows={3}
              placeholder="Add notes for doctor (optional)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-indigo-700 to-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-700/20 transition hover:from-indigo-800 hover:to-cyan-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Booking...
                </>
              ) : (
                "Book Appointment"
              )}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Your Appointments ({upcomingAppointments.length})
          </h2>

          {appointments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">No appointments yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {appointments.map((appointment) => (
                <article
                  key={appointment._id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">
                      {appointment.petId?.name || "Pet"} with{" "}
                      {appointment.doctorId?.name || "Doctor"}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        appointment.status === "CANCELLED"
                          ? "bg-rose-100 text-rose-700"
                          : appointment.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {appointment.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {appointment.date} at {appointment.time}
                  </p>

                  {appointment.notes ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Notes: {appointment.notes}
                    </p>
                  ) : null}

                  {appointment.status !== "CANCELLED" &&
                  appointment.status !== "COMPLETED" ? (
                    <button
                      type="button"
                      disabled={updatingAppointmentId === appointment._id}
                      onClick={() => onCancelAppointment(appointment._id)}
                      className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {updatingAppointmentId === appointment._id
                        ? "Cancelling..."
                        : "Cancel"}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

