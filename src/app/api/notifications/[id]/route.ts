import mongoose from "mongoose";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import Notification from "@/lib/db/models/Notification";
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

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const notificationId = params.id;
    if (!isValidObjectId(notificationId)) {
      return NextResponse.json(
        { message: "Invalid notification id." },
        { status: 400 }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const isRead =
      typeof payload?.isRead === "boolean" ? payload.isRead : true;

    await connectDB();

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { $set: { isRead } },
      { new: true }
    ).lean();

    if (!notification) {
      return NextResponse.json(
        { message: "Notification not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error("Notification PATCH by id error:", error);
    return NextResponse.json(
      { message: "Could not update notification." },
      { status: 500 }
    );
  }
}
