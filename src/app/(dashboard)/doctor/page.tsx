"use client";

import { useSession } from "next-auth/react";
import OwnerAppointmentBooking from "@/components/doctor/OwnerAppointmentBooking";
import DoctorAppointmentDashboard from "@/components/doctor/DoctorAppointmentDashboard";

export default function DoctorPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  if (role === "DOCTOR" || role === "ADMIN") {
    return <DoctorAppointmentDashboard />;
  }

  return <OwnerAppointmentBooking />;
}

