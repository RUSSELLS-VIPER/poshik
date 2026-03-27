import { connectDB } from "@/lib/db/mongodb";
import Pet from "@/lib/db/models/Pet";
import { authOptions } from "@/lib/auth/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    const pet = await Pet.create({
      name: body?.name?.trim(),
      type: body?.type?.trim(),
      breed: body?.breed?.trim(),
      age: Number(body?.age ?? 0),
      location: body?.location,
      isPublic: typeof body?.isPublic === "boolean" ? body.isPublic : true,
      imageUrl: typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "",
      ownerId: userId,
    });

    return NextResponse.json(pet, { status: 201 });
  } catch (error) {
    console.error("Pet POST error:", error);
    return NextResponse.json(
      { message: "Could not create pet." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const discoverMode = searchParams.get("discover") === "true";

    const query = discoverMode
      ? { ownerId: { $ne: userId } }
      : role === "ADMIN"
        ? {}
        : { ownerId: userId };

    const petQuery = Pet.find(query).sort({ createdAt: -1 });
    const shouldPopulateOwner = discoverMode || role === "ADMIN";

    if (discoverMode) {
      petQuery.select(
        "_id ownerId name type breed age imageUrl location isPublic createdAt"
      );
    }

    if (shouldPopulateOwner) {
      petQuery.populate("ownerId", "name role");
    }

    const pets = await petQuery.lean();

    return NextResponse.json(pets);
  } catch (error) {
    console.error("Pet GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch pets." },
      { status: 500 }
    );
  }
}
