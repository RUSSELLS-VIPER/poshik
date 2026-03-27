import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Event from "@/lib/db/models/Event";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

const RECENT_EVENT_GRACE_MINUTES = 60;

function toPositiveIntegerOrNull(value: unknown): number | null {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 1) {
    return null;
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

function readImageUrlFromPayload(payload: any): string {
  const candidates = [
    payload?.imageUrl,
    payload?.image,
    payload?.posterUrl,
    payload?.poster,
    payload?.coverImage,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }
    return normalizeIncomingImageUrl(candidate);
  }

  return "";
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

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id ?? "";
    const role = session?.user?.role;
    const isAdmin = role === "ADMIN";
    const searchParams = new URL(req.url).searchParams;
    const includePast = searchParams.get("includePast") === "true";
    const includeInactive = searchParams.get("includeInactive") === "true";

    await connectDB();

    const query: Record<string, unknown> = {};
    if (!isAdmin || !includeInactive) {
      query.isActive = true;
    }

    if (!includePast) {
      const now = new Date();
      const graceStart = new Date(
        now.getTime() - RECENT_EVENT_GRACE_MINUTES * 60 * 1000
      );
      query.startAt = { $gte: graceStart };
    }

    const events = await Event.find(query)
      .populate("hostedBy", "name role")
      .sort({ startAt: includePast ? -1 : 1 });

    const normalized = events.map((event: any) => {
      const participantIds = Array.isArray(event.participants)
        ? event.participants.map((participant: any) => participant.toString())
        : [];

      return {
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
        isParticipating: userId ? participantIds.includes(userId) : false,
      };
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("Events GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch events." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only admin can host community events." },
        { status: 403 }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const title = typeof payload?.title === "string" ? payload.title.trim() : "";
    const description =
      typeof payload?.description === "string" ? payload.description.trim() : "";
    const location =
      typeof payload?.location === "string" ? payload.location.trim() : "";
    const imageUrl = readImageUrlFromPayload(payload);
    const startAtInput =
      typeof payload?.startAt === "string" ? payload.startAt.trim() : "";
    const maxParticipants = toPositiveIntegerOrNull(payload?.maxParticipants);

    if (!title || !description || !location || !startAtInput || !imageUrl) {
      return NextResponse.json(
        { message: "title, description, location, imageUrl and startAt are required." },
        { status: 400 }
      );
    }

    const startAt = new Date(startAtInput);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { message: "Invalid start date/time." },
        { status: 400 }
      );
    }

    await connectDB();

    const created = await Event.create({
      title,
      description,
      location,
      imageUrl,
      startAt,
      hostedBy: userId,
      participants: [],
      maxParticipants,
      isActive: true,
    });

    const event = await Event.findById(created._id)
      .populate("hostedBy", "name role");

    if (!event) {
      return NextResponse.json(
        { message: "Could not create event." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
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
        participantsCount: 0,
        isParticipating: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Events POST error:", error);
    return NextResponse.json(
      { message: "Could not create event." },
      { status: 500 }
    );
  }
}
