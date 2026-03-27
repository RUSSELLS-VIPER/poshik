import mongoose, { Schema, models } from "mongoose";

const ProductSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0 },
    category: { type: String, default: "GENERAL", trim: true },
    imageUrl: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default models.Product || mongoose.model("Product", ProductSchema);
