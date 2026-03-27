import mongoose from "mongoose";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Event from "@/lib/db/models/Event";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

function toPositiveIntegerOrNull(value: unknown): number | null {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error("Invalid maxParticipants value.");
  }

  return Math.trunc(parsed);
}

function normalizeIncomingImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.startsWith("uploads/")) {
    return `/${trimmed}`;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith("www.")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function readImageUrlFromPayload(payload: any): string | null {
  const keys = ["imageUrl", "image", "posterUrl", "poster", "coverImage"];
  for (const key of keys) {
    if (!(key in payload)) {
      continue;
    }
    const candidate = payload[key];
    if (typeof candidate !== "string") {
      continue;
    }
    return normalizeIncomingImageUrl(candidate);
  }
  return null;
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

function normalizeUpdatedEvent(updated: any) {
  return {
    _id: updated._id.toString(),
    title: updated.title,
    description: updated.description,
    location: updated.location,
    imageUrl: resolveEventImageUrl(updated),
    startAt: updated.startAt,
    isActive: updated.isActive,
    maxParticipants:
      typeof updated.maxParticipants === "number" ? updated.maxParticipants : null,
    hostedBy: updated.hostedBy
      ? {
          _id: updated.hostedBy._id.toString(),
          name: updated.hostedBy.name,
          role: updated.hostedBy.role,
        }
      : null,
    participantsCount: Array.isArray(updated.participants)
      ? updated.participants.length
      : 0,
  };
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const eventId = params.id;
    if (!isValidObjectId(eventId)) {
      return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
    }

    await connectDB();

    const event = await Event.findById(eventId).populate("hostedBy", "name role");
    if (!event) {
      return NextResponse.json({ message: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({
      _id: event._id.toString(),
      title: event.title,
      description: event.description,
      location: event.location,
      imageUrl: resolveEventImageUrl(event),
      startAt: event.startAt,
      isActive: event.isActive,
      maxParticipants:
        typeof event.maxParticipants === "number" ? event.maxParticipants : null,
      hostedBy: event.hostedBy
        ? {
            _id: event.hostedBy._id.toString(),
            name: event.hostedBy.name,
            role: event.hostedBy.role,
          }
        : null,
      participantsCount: Array.isArray(event.participants)
        ? event.participants.length
        : 0,
    });
  } catch (error) {
    console.error("Event GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch event." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only admin can update events." },
        { status: 403 }
      );
    }

    const eventId = params.id;
    if (!isValidObjectId(eventId)) {
      return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
    }

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const updates: Record<string, unknown> = {};

    if (typeof payload?.isActive === "boolean") {
      updates.isActive = payload.isActive;
    }

    if (typeof payload?.title === "string") {
      const title = payload.title.trim();
      if (!title) {
        return NextResponse.json(
          { message: "title cannot be empty." },
          { status: 400 }
        );
      }
      updates.title = title;
    }

    if (typeof payload?.description === "string") {
      const description = payload.description.trim();
      if (!description) {
        return NextResponse.json(
          { message: "description cannot be empty." },
          { status: 400 }
        );
      }
      updates.description = description;
    }

    if (typeof payload?.location === "string") {
      const location = payload.location.trim();
      if (!location) {
        return NextResponse.json(
          { message: "location cannot be empty." },
          { status: 400 }
        );
      }
      updates.location = location;
    }

    const nextImageUrl = readImageUrlFromPayload(payload);
    if (nextImageUrl !== null) {
      updates.imageUrl = nextImageUrl;
    }

    if (typeof payload?.startAt === "string") {
      const nextDate = new Date(payload.startAt.trim());
      if (Number.isNaN(nextDate.getTime())) {
        return NextResponse.json(
          { message: "Invalid startAt value." },
          { status: 400 }
        );
      }
      updates.startAt = nextDate;
    }

    if ("maxParticipants" in payload) {
      try {
        updates.maxParticipants = toPositiveIntegerOrNull(
          payload.maxParticipants
        );
      } catch {
        return NextResponse.json(
          { message: "maxParticipants must be a positive number or null." },
          { status: 400 }
        );
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { message: "No valid event fields provided for update." },
        { status: 400 }
      );
    }

    await connectDB();

    const updated = await Event.findByIdAndUpdate(
      eventId,
      updates,
      { new: true }
    ).populate("hostedBy", "name role");

    if (!updated) {
      return NextResponse.json({ message: "Event not found." }, { status: 404 });
    }

    return NextResponse.json(normalizeUpdatedEvent(updated));
  } catch (error) {
    console.error("Event PATCH error:", error);
    return NextResponse.json(
      { message: "Could not update event." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only admin can delete events." },
        { status: 403 }
      );
    }

    const eventId = params.id;
    if (!isValidObjectId(eventId)) {
      return NextResponse.json({ message: "Invalid event id." }, { status: 400 });
    }

    await connectDB();

    const deleted = await Event.findByIdAndDelete(eventId);
    if (!deleted) {
      return NextResponse.json({ message: "Event not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Event deleted successfully." });
  } catch (error) {
    console.error("Event DELETE error:", error);
    return NextResponse.json(
      { message: "Could not delete event." },
      { status: 500 }
    );
  }
}
