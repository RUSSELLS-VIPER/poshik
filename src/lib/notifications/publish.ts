import { connectDB } from "@/lib/db/mongodb";
import Notification from "@/lib/db/models/Notification";
import mongoose from "mongoose";

export type UserRole = "OWNER" | "DOCTOR" | "SHOP" | "ADMIN";
export type NotificationType = "ORDER_STATUS" | "APPOINTMENT_STATUS" | "KYC_STATUS";
export type NotificationEntityType = "ORDER" | "APPOINTMENT" | "KYC";

export type NotificationPayload = {
  userId: string;
  role: UserRole;
  type: NotificationType;
  entityType: NotificationEntityType;
  entityId: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
};

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

export async function publishNotifications(payloads: NotificationPayload[]) {
  const validPayloads = payloads.filter(
    (payload) =>
      isValidObjectId(payload.userId) &&
      payload.entityId.trim().length > 0 &&
      payload.title.trim().length > 0 &&
      payload.message.trim().length > 0
  );

  if (validPayloads.length === 0) {
    return;
  }

  await connectDB();

  await Notification.insertMany(
    validPayloads.map((payload) => ({
      userId: payload.userId,
      role: payload.role,
      type: payload.type,
      entityType: payload.entityType,
      entityId: payload.entityId,
      title: payload.title,
      message: payload.message,
      metadata: payload.metadata ?? {},
      isRead: false,
    }))
  );
}
