import { connectDB } from "@/lib/db/mongodb";
import Pet from "@/lib/db/models/Pet";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();

    const pets = await Pet.find({ isPublic: true })
      .select("_id ownerId name type breed age imageUrl location isPublic createdAt")
      .populate("ownerId", "name")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(pets);
  } catch (error) {
    console.error("Public discover pets error:", error);
    return NextResponse.json(
      { message: "Could not fetch public discover pets." },
      { status: 500 }
    );
  }
}
