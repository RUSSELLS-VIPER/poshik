import mongoose, { Schema, models } from "mongoose";

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    imageUrl: { type: String, default: "", trim: true, maxlength: 500 },
    startAt: { type: Date, required: true },
    hostedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    maxParticipants: { type: Number, min: 1, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

EventSchema.index({ startAt: 1, isActive: 1 });
EventSchema.index({ hostedBy: 1, createdAt: -1 });

const existingEventModel = models.Event as mongoose.Model<any> | undefined;

if (existingEventModel && !existingEventModel.schema.path("imageUrl")) {
  delete models.Event;
}

export default models.Event || mongoose.model("Event", EventSchema);
