"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertCircle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";

type AppointmentItem = {
  _id: string;
  date: string;
  time: string;
  notes?: string;
  status: string;
  ownerId?: {
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

const doctorStatusOptions = ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED"];

export default function DoctorAppointmentDashboard() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<
    string | null
  >(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const upcomingCount = useMemo(
    () =>
      appointments.filter(
        (appointment) =>
          appointment.status !== "COMPLETED" && appointment.status !== "CANCELLED"
      ).length,
    [appointments]
  );

  const loadAppointments = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/appointments", { cache: "no-store" });
      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData?.message ?? "Could not fetch appointments.");
      }

      setAppointments(Array.isArray(responseData) ? responseData : []);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not fetch appointments.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && (role === "DOCTOR" || role === "ADMIN")) {
      void loadAppointments();
    } else if (status !== "loading") {
      setIsLoading(false);
    }
  }, [status, role, loadAppointments]);

  const onChangeStatus = async (appointmentId: string, nextStatus: string) => {
    setFeedback(null);
    setUpdatingAppointmentId(appointmentId);

    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(
          responseData?.message ?? "Could not update appointment status."
        );
      }

      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment._id === appointmentId
            ? { ...appointment, status: responseData.status }
            : appointment
        )
      );
      setFeedback({ type: "success", message: "Appointment status updated." });
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not update appointment.",
      });
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          Loading doctor dashboard...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800 shadow-sm">
          Login as doctor to manage appointments.
        </div>
      </div>
    );
  }

  if (role !== "DOCTOR" && role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-800 shadow-sm">
          This dashboard is for doctors.
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-700 via-violet-700 to-violet-700 p-6 text-white shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-100">
          Doctor Dashboard
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
          Manage pet appointments
        </h1>
        <p className="mt-2 text-sm text-violet-100/90">
          Review bookings and update statuses for upcoming consultations.
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Total appointments</p>
            <p className="text-2xl font-semibold">{appointments.length}</p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs text-violet-100/90">Upcoming</p>
            <p className="text-2xl font-semibold">{upcomingCount}</p>
          </div>
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
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-emerald-700" />
          <h2 className="text-lg font-semibold text-slate-900">Appointments</h2>
        </div>

        {appointments.length === 0 ? (
          <p className="text-sm text-slate-600">No appointments assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => (
              <article
                key={appointment._id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {appointment.petId?.name || "Pet"} •{" "}
                      {appointment.ownerId?.name || "Owner"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {appointment.date} at {appointment.time}
                    </p>
                    <p className="text-xs text-slate-500">
                      {appointment.petId?.type || "Pet"}{" "}
                      {appointment.petId?.breed
                        ? `(${appointment.petId.breed})`
                        : ""}
                    </p>
                  </div>

                  <div className="text-right">
                    <label className="text-xs text-slate-500">Status</label>
                    <select
                      value={appointment.status}
                      disabled={updatingAppointmentId === appointment._id}
                      onChange={(event) =>
                        onChangeStatus(appointment._id, event.target.value)
                      }
                      className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {doctorStatusOptions.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {appointment.notes ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Owner notes: {appointment.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

