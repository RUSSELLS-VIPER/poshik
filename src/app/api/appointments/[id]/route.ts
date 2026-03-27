import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Appointment from "@/lib/db/models/Appointment";
import { notifyAppointmentStatusChange } from "@/lib/notifications/status";

type RouteContext = {
  params: {
    id: string;
  };
};

const DOCTOR_ALLOWED_STATUSES = new Set(["CONFIRMED", "COMPLETED", "CANCELLED"]);
const ALL_STATUSES = new Set(["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED"]);

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { message: "Invalid appointment id." },
        { status: 400 }
      );
    }

    await connectDB();

    const appointment = await Appointment.findById(params.id)
      .populate("ownerId", "name email")
      .populate("doctorId", "name email")
      .populate("petId", "name type breed imageUrl");

    if (!appointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    const isOwner = appointment.ownerId?._id?.toString() === userId;
    const isDoctor = appointment.doctorId?._id?.toString() === userId;

    if (role !== "ADMIN" && !isOwner && !isDoctor) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error("Appointment GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch appointment." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json(
        { message: "Invalid appointment id." },
        { status: 400 }
      );
    }

    await connectDB();

    const appointment = await Appointment.findById(params.id);
    if (!appointment) {
      return NextResponse.json(
        { message: "Appointment not found." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const nextStatus =
      typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";

    if (!nextStatus) {
      return NextResponse.json(
        { message: "Status is required." },
        { status: 400 }
      );
    }

    const previousStatus = String(appointment.status ?? "");
    const ownerId = appointment.ownerId?.toString() ?? "";
    const doctorId = appointment.doctorId?.toString() ?? "";

    const saveAndNotify = async (resolvedStatus: string) => {
      const hasChanged = previousStatus !== resolvedStatus;
      appointment.status = resolvedStatus;
      await appointment.save();

      if (hasChanged) {
        try {
          await notifyAppointmentStatusChange({
            appointmentId: appointment._id.toString(),
            ownerId,
            doctorId,
            nextStatus: resolvedStatus,
            previousStatus,
            actorRole: role,
          });
        } catch (notificationError) {
          console.error("Appointment notification error:", notificationError);
        }
      }

      return NextResponse.json(appointment);
    };

    if (role === "ADMIN") {
      if (!ALL_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          { message: "Invalid appointment status." },
          { status: 400 }
        );
      }
      return saveAndNotify(nextStatus);
    }

    if (role === "DOCTOR") {
      if (appointment.doctorId?.toString() !== userId) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      if (!DOCTOR_ALLOWED_STATUSES.has(nextStatus)) {
        return NextResponse.json(
          { message: "Invalid status for doctor." },
          { status: 400 }
        );
      }

      return saveAndNotify(nextStatus);
    }

    if (appointment.ownerId?.toString() !== userId) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    if (nextStatus !== "CANCELLED") {
      return NextResponse.json(
        { message: "Owners can only cancel appointments." },
        { status: 400 }
      );
    }

    return saveAndNotify("CANCELLED");
  } catch (error) {
    console.error("Appointment PATCH error:", error);
    return NextResponse.json(
      { message: "Could not update appointment." },
      { status: 500 }
    );
  }
}
