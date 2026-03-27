import User from "@/lib/db/models/User";
import {
  publishNotifications,
  type NotificationPayload,
  type UserRole,
} from "@/lib/notifications/publish";

type OrderNotificationInput = {
  orderId: string;
  buyerId: string;
  shopIds: string[];
  nextStatus: string;
  previousStatus?: string;
  actorRole?: string;
};

type AppointmentNotificationInput = {
  appointmentId: string;
  ownerId: string;
  doctorId: string;
  nextStatus: string;
  previousStatus?: string;
  actorRole?: string;
};

type KycNotificationInput = {
  userId: string;
  status: string;
  actorRole?: string;
};

type BasicUser = {
  _id: string;
  role: UserRole;
};

function formatStatusLabel(status: string): string {
  return status
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function shortId(value: string): string {
  return value.slice(-8).toUpperCase();
}

async function getRoleMap(userIds: string[]): Promise<Map<string, UserRole>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return new Map<string, UserRole>();
  }

  const users = (await User.find({ _id: { $in: uniqueIds } })
    .select("_id role")
    .lean()) as BasicUser[];

  return new Map(users.map((user) => [String(user._id), user.role]));
}

async function getAdminIds(): Promise<string[]> {
  const admins = (await User.find({ role: "ADMIN" })
    .select("_id")
    .lean()) as Array<{ _id: string }>;
  return admins.map((admin) => String(admin._id));
}

function buildOrderMessageByRole(
  role: UserRole,
  orderId: string,
  nextStatus: string,
  previousStatus?: string,
  actorRole?: string
): { title: string; message: string } {
  const next = formatStatusLabel(nextStatus);
  const previous = previousStatus ? formatStatusLabel(previousStatus) : "";
  const orderRef = shortId(orderId);
  const transitionText = previous
    ? `moved from ${previous} to ${next}`
    : `is now ${next}`;

  if (role === "OWNER") {
    return {
      title: "Order Status Updated",
      message: `Your order #${orderRef} ${transitionText}.`,
    };
  }

  if (role === "SHOP") {
    return {
      title: "Order Status Changed",
      message: `Order #${orderRef} ${transitionText}.`,
    };
  }

  return {
    title: "Order Status Event",
    message: `Order #${orderRef} changed to ${next} by ${actorRole ?? "SYSTEM"}.`,
  };
}

function buildAppointmentMessageByRole(
  role: UserRole,
  appointmentId: string,
  nextStatus: string,
  previousStatus?: string,
  actorRole?: string
): { title: string; message: string } {
  const next = formatStatusLabel(nextStatus);
  const previous = previousStatus ? formatStatusLabel(previousStatus) : "";
  const ref = shortId(appointmentId);
  const transitionText = previous
    ? `moved from ${previous} to ${next}`
    : `is now ${next}`;

  if (role === "OWNER") {
    return {
      title: "Appointment Status Updated",
      message: `Your appointment #${ref} ${transitionText}.`,
    };
  }

  if (role === "DOCTOR") {
    return {
      title: "Appointment Status Changed",
      message: `Appointment #${ref} ${transitionText}.`,
    };
  }

  return {
    title: "Appointment Status Event",
    message: `Appointment #${ref} changed to ${next} by ${actorRole ?? "SYSTEM"}.`,
  };
}

export async function notifyOrderStatusChange({
  orderId,
  buyerId,
  shopIds,
  nextStatus,
  previousStatus,
  actorRole,
}: OrderNotificationInput) {
  const recipientIds = new Set<string>([buyerId, ...shopIds]);
  const adminIds = await getAdminIds();
  adminIds.forEach((id) => recipientIds.add(id));

  const roleMap = await getRoleMap(Array.from(recipientIds));
  const payloads: NotificationPayload[] = [];

  recipientIds.forEach((recipientId) => {
    const role = roleMap.get(recipientId);
    if (!role) {
      return;
    }

    const content = buildOrderMessageByRole(
      role,
      orderId,
      nextStatus,
      previousStatus,
      actorRole
    );

    payloads.push({
      userId: recipientId,
      role,
      type: "ORDER_STATUS",
      entityType: "ORDER",
      entityId: orderId,
      title: content.title,
      message: content.message,
      metadata: {
        nextStatus,
        previousStatus: previousStatus ?? null,
        actorRole: actorRole ?? "SYSTEM",
      },
    });
  });

  await publishNotifications(payloads);
}

export async function notifyAppointmentStatusChange({
  appointmentId,
  ownerId,
  doctorId,
  nextStatus,
  previousStatus,
  actorRole,
}: AppointmentNotificationInput) {
  const recipientIds = new Set<string>([ownerId, doctorId]);
  const adminIds = await getAdminIds();
  adminIds.forEach((id) => recipientIds.add(id));

  const roleMap = await getRoleMap(Array.from(recipientIds));
  const payloads: NotificationPayload[] = [];

  recipientIds.forEach((recipientId) => {
    const role = roleMap.get(recipientId);
    if (!role) {
      return;
    }

    const content = buildAppointmentMessageByRole(
      role,
      appointmentId,
      nextStatus,
      previousStatus,
      actorRole
    );

    payloads.push({
      userId: recipientId,
      role,
      type: "APPOINTMENT_STATUS",
      entityType: "APPOINTMENT",
      entityId: appointmentId,
      title: content.title,
      message: content.message,
      metadata: {
        nextStatus,
        previousStatus: previousStatus ?? null,
        actorRole: actorRole ?? "SYSTEM",
      },
    });
  });

  await publishNotifications(payloads);
}

export async function notifyKycStatusChange({
  userId,
  status,
  actorRole,
}: KycNotificationInput) {
  const recipientIds = new Set<string>([userId]);
  const adminIds = await getAdminIds();
  adminIds.forEach((id) => recipientIds.add(id));

  const roleMap = await getRoleMap(Array.from(recipientIds));
  const payloads: NotificationPayload[] = [];
  const formattedStatus = formatStatusLabel(status);

  recipientIds.forEach((recipientId) => {
    const role = roleMap.get(recipientId);
    if (!role) {
      return;
    }

    if (role === "ADMIN") {
      payloads.push({
        userId: recipientId,
        role,
        type: "KYC_STATUS",
        entityType: "KYC",
        entityId: userId,
        title: "New KYC Status Event",
        message: `User KYC status changed to ${formattedStatus} by ${
          actorRole ?? "SYSTEM"
        }.`,
        metadata: {
          status,
          actorRole: actorRole ?? "SYSTEM",
        },
      });
      return;
    }

    payloads.push({
      userId: recipientId,
      role,
      type: "KYC_STATUS",
      entityType: "KYC",
      entityId: userId,
      title: "KYC Status Updated",
      message: `Your KYC status is now ${formattedStatus}.`,
      metadata: {
        status,
        actorRole: actorRole ?? "SYSTEM",
      },
    });
  });

  await publishNotifications(payloads);
}
