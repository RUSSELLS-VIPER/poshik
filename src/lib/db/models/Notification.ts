import mongoose, { Schema, models } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["OWNER", "DOCTOR", "SHOP", "ADMIN"],
      required: true,
    },
    type: {
      type: String,
      enum: ["ORDER_STATUS", "APPOINTMENT_STATUS", "KYC_STATUS"],
      required: true,
    },
    entityType: {
      type: String,
      enum: ["ORDER", "APPOINTMENT", "KYC"],
      required: true,
    },
    entityId: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default models.Notification ||
  mongoose.model("Notification", NotificationSchema);
