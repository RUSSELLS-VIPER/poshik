import mongoose from "mongoose";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Event from "@/lib/db/models/Event";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function resolveEventImageUrl(event: any): string {
  const candidates = [
    event?.imageUrl,
    event?.image,
    event?.posterUrl,
    event?.poster,
    event?.coverImage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    const value = candidate.trim();
    if (!value) {
      continue;
    }
    if (value.startsWith("/")) {
      return value;
    }
    if (value.startsWith("uploads/")) {
      return `/${value}`;
    }
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return value;
    }
    if (value.startsWith("//")) {
      return `https:${value}`;
    }
    if (value.startsWith("www.")) {
      return `https://${value}`;
    }
    return value;
  }

  return "";
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { message: "Login required to participate in events." },
        { status: 401 }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const eventId =
      typeof payload?.eventId === "string" ? payload.eventId.trim() : "";

    if (!eventId) {
      return NextResponse.json({ message: "eventId is required." }, { status: 400 });
    }

    if (!isValidObjectId(eventId)) {
      return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
    }

    await connectDB();

    const event = await Event.findById(eventId).populate("hostedBy", "name role");
    if (!event || !event.isActive) {
      return NextResponse.json({ message: "Event not found." }, { status: 404 });
    }

    const alreadyJoined = Array.isArray(event.participants)
      ? event.participants.some(
          (participant: mongoose.Types.ObjectId) =>
            participant.toString() === userId
        )
      : false;

    if (
      !alreadyJoined &&
      typeof event.maxParticipants === "number" &&
      event.maxParticipants > 0 &&
      event.participants.length >= event.maxParticipants
    ) {
      return NextResponse.json(
        { message: "Event participant limit reached." },
        { status: 400 }
      );
    }

    if (!alreadyJoined) {
      event.participants.push(new mongoose.Types.ObjectId(userId));
      await event.save();
    }

    const participantIds = Array.isArray(event.participants)
      ? event.participants.map((participant: mongoose.Types.ObjectId) =>
          participant.toString()
        )
      : [];

    return NextResponse.json({
      message: alreadyJoined
        ? "You are already participating in this event."
        : "Event participation confirmed.",
      event: {
        _id: event._id.toString(),
        title: event.title,
        description: event.description,
        location: event.location,
        imageUrl: resolveEventImageUrl(event),
        startAt: event.startAt,
        maxParticipants:
          typeof event.maxParticipants === "number" ? event.maxParticipants : null,
        hostedBy: event.hostedBy
          ? {
              _id: event.hostedBy._id.toString(),
              name: event.hostedBy.name,
              role: event.hostedBy.role,
            }
          : null,
        participantsCount: participantIds.length,
        isParticipating: participantIds.includes(userId),
      },
    });
  } catch (error) {
    console.error("Event register POST error:", error);
    return NextResponse.json(
      { message: "Could not register for event." },
      { status: 500 }
    );
  }
}
