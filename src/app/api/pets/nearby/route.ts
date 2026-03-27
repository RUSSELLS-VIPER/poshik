import { connectDB } from "@/lib/db/mongodb";
import Pet from "@/lib/db/models/Pet";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const includeAllPets = searchParams.get("all") === "true";

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));

    if (includeAllPets) {
      const pets = await Pet.find({
        isPublic: true,
        "location.coordinates.0": { $type: "number" },
        "location.coordinates.1": { $type: "number" },
      }).select("_id name type breed imageUrl location");

      return NextResponse.json(pets);
    }

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return NextResponse.json(
        { message: "lat and lng query parameters are required." },
        { status: 400 }
      );
    }

    const pets = await Pet.find({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: 5000, // 5km
        },
      },
      isPublic: true,
    }).select("_id name type breed imageUrl location");

    return NextResponse.json(pets);
  } catch (error) {
    console.error("Nearby pets error:", error);
    return NextResponse.json(
      { message: "Could not fetch nearby pets." },
      { status: 500 }
    );
  }
}
