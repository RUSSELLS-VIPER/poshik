"use client";

import { useState } from "react";

export default function VetPage() {
  const [doctorId, setDoctorId] = useState("");

  const book = async () => {
    await fetch("/api/appointments", {
      method: "POST",
      body: JSON.stringify({
        ownerId: "OWNER_ID",
        doctorId,
        date: "2026-03-25",
        time: "10:00",
      }),
    });
  };

  return (
    <div>
      <input
        placeholder="Doctor ID"
        onChange={(e) => setDoctorId(e.target.value)}
      />
      <button onClick={book}>Book Appointment</button>
    </div>
  );
}