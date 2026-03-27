import { connectDB } from "@/lib/db/mongodb";
import Appointment from "@/lib/db/models/Appointment";
import Pet from "@/lib/db/models/Pet";
import User from "@/lib/db/models/User";
import { authOptions } from "@/lib/auth/auth";
import { notifyAppointmentStatusChange } from "@/lib/notifications/status";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import mongoose from "mongoose";

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (role !== "OWNER" && role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only pet owners can book appointments." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const doctorId =
      typeof body?.doctorId === "string" ? body.doctorId.trim() : "";
    const petId = typeof body?.petId === "string" ? body.petId.trim() : "";
    const date = typeof body?.date === "string" ? body.date.trim() : "";
    const time = typeof body?.time === "string" ? body.time.trim() : "";
    const notes = typeof body?.notes === "string" ? body.notes.trim() : "";

    if (!doctorId || !petId || !date || !time) {
      return NextResponse.json(
        { message: "doctorId, petId, date, and time are required." },
        { status: 400 }
      );
    }

    if (!isValidObjectId(doctorId) || !isValidObjectId(petId)) {
      return NextResponse.json(
        { message: "Invalid doctorId or petId." },
        { status: 400 }
      );
    }

    await connectDB();

    const doctor = await User.findOne({ _id: doctorId, role: "DOCTOR" });
    if (!doctor) {
      return NextResponse.json(
        { message: "Doctor not found." },
        { status: 404 }
      );
    }

    const petQuery: Record<string, unknown> =
      role === "ADMIN" ? { _id: petId } : { _id: petId, ownerId: userId };
    const pet = await Pet.findOne(petQuery);

    if (!pet) {
      return NextResponse.json(
        { message: "Pet not found for this owner." },
        { status: 404 }
      );
    }

    const appointment = await Appointment.create({
      ownerId: role === "ADMIN" && body?.ownerId ? body.ownerId : userId,
      doctorId,
      petId,
      date,
      time,
      notes,
      status: "BOOKED",
    });

    try {
      await notifyAppointmentStatusChange({
        appointmentId: appointment._id.toString(),
        ownerId: appointment.ownerId?.toString() ?? "",
        doctorId: appointment.doctorId?.toString() ?? "",
        nextStatus: "BOOKED",
        actorRole: role,
      });
    } catch (notificationError) {
      console.error("Appointment create notification error:", notificationError);
    }

    const populated = await Appointment.findById(appointment._id)
      .populate("ownerId", "name email")
      .populate("doctorId", "name email")
      .populate("petId", "name type breed imageUrl");

    return NextResponse.json(populated, { status: 201 });
  } catch (error) {
    console.error("Appointment POST error:", error);
    return NextResponse.json(
      { message: "Could not create appointment." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const query: Record<string, unknown> = {};

    if (role === "OWNER") {
      query.ownerId = userId;
    } else if (role === "DOCTOR") {
      query.doctorId = userId;
    } else if (role !== "ADMIN") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const appointments = await Appointment.find(query)
      .populate("ownerId", "name email")
      .populate("doctorId", "name email")
      .populate("petId", "name type breed imageUrl")
      .sort({ createdAt: -1 });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Appointment GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch appointments." },
      { status: 500 }
    );
  }
}
