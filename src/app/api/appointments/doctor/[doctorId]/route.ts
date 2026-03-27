import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Appointment from "@/lib/db/models/Appointment";

type RouteContext = {
  params: {
    doctorId: string;
  };
};

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

    if (!isValidObjectId(params.doctorId)) {
      return NextResponse.json(
        { message: "Invalid doctor id." },
        { status: 400 }
      );
    }

    if (
      role !== "ADMIN" &&
      role !== "OWNER" &&
      !(role === "DOCTOR" && userId === params.doctorId)
    ) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    await connectDB();

    const appointments = await Appointment.find({ doctorId: params.doctorId })
      .populate("ownerId", "name email")
      .populate("petId", "name type breed imageUrl")
      .sort({ date: 1, time: 1 });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error("Doctor appointments GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch doctor appointments." },
      { status: 500 }
    );
  }
}

