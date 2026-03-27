import mongoose, { Schema, models } from "mongoose";

const PetSchema = new Schema(
    {
        ownerId: { type: Schema.Types.ObjectId, ref: "User" },
        name: String,
        type: String,
        breed: String,
        age: Number,
        imageUrl: {
            type: String,
            default: "",
        },

        location: {
            type: {
                type: String,
                enum: ["Point"],
                default: "Point",
            },
            coordinates: {
                type: [Number], // [lng, lat]
                default: [0, 0],
            },
        },

        isPublic: { type: Boolean, default: true },
    },
    { timestamps: true }
);

PetSchema.index({ location: "2dsphere" });

export default models.Pet || mongoose.model("Pet", PetSchema);
