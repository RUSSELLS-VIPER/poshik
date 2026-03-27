import mongoose, { Schema, models } from "mongoose";

const CartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: "Product" },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

CartSchema.index({ userId: 1 }, { unique: true });

export default models.Cart || mongoose.model("Cart", CartSchema);
