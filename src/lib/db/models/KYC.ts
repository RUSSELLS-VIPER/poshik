import mongoose, { Schema, models } from "mongoose";

const KYCSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        documentUrl: String,
        status: {
            type: String,
            enum: ["PENDING", "APPROVED", "REJECTED"],
            default: "PENDING",
        },
    },
    { timestamps: true }
);

export default models.KYC || mongoose.model("KYC", KYCSchema);