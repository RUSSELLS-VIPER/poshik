import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Notification from "@/lib/db/models/Notification";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(100, Math.trunc(parsed)));
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const searchParams = new URL(req.url).searchParams;
    const limit = parseLimit(searchParams.get("limit"));
    const unreadOnly = searchParams.get("unread") === "true";

    await connectDB();

    const query: Record<string, unknown> = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Notifications GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch notifications." },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const result = await Notification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    return NextResponse.json({
      message: "All notifications marked as read.",
      updatedCount: result.modifiedCount ?? 0,
    });
  } catch (error) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json(
      { message: "Could not update notifications." },
      { status: 500 }
    );
  }
}
