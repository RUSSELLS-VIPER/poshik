import mongoose, { Schema, models } from "mongoose";

const AppointmentSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    petId: { type: Schema.Types.ObjectId, ref: "Pet", required: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED"],
      default: "BOOKED",
    },
  },
  { timestamps: true }
);

AppointmentSchema.index({ doctorId: 1, createdAt: -1 });
AppointmentSchema.index({ ownerId: 1, createdAt: -1 });

export default models.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);
