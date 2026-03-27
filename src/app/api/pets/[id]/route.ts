import { connectDB } from "@/lib/db/mongodb";
import Pet from "@/lib/db/models/Pet";
import { authOptions } from "@/lib/auth/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

type RouteContext = {
  params: {
    id: string;
  };
};

async function authorizePetAccess(petId: string, userId: string, role?: string) {
  const pet = await Pet.findById(petId);
  if (!pet) {
    return {
      error: NextResponse.json({ message: "Pet not found." }, { status: 404 }),
      pet: null,
    };
  }

  if (role !== "ADMIN" && pet.ownerId?.toString() !== userId) {
    return {
      error: NextResponse.json({ message: "Forbidden." }, { status: 403 }),
      pet: null,
    };
  }

  return { error: null, pet };
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { error, pet } = await authorizePetAccess(params.id, userId, role);
    if (error) {
      return error;
    }

    return NextResponse.json(pet);
  } catch (error) {
    console.error("Pet GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch pet." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { error } = await authorizePetAccess(params.id, userId, role);
    if (error) {
      return error;
    }

    const payload = await req.json();
    const updates = {
      name: typeof payload?.name === "string" ? payload.name.trim() : undefined,
      type: typeof payload?.type === "string" ? payload.type.trim() : undefined,
      breed:
        typeof payload?.breed === "string" ? payload.breed.trim() : undefined,
      age:
        typeof payload?.age === "number"
          ? payload.age
          : Number(payload?.age ?? 0),
      isPublic:
        typeof payload?.isPublic === "boolean" ? payload.isPublic : undefined,
      imageUrl:
        typeof payload?.imageUrl === "string" ? payload.imageUrl.trim() : "",
    };

    const pet = await Pet.findByIdAndUpdate(
      params.id,
      {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.type !== undefined ? { type: updates.type } : {}),
        ...(updates.breed !== undefined ? { breed: updates.breed } : {}),
        ...(Number.isNaN(updates.age) ? {} : { age: updates.age }),
        ...(updates.isPublic !== undefined ? { isPublic: updates.isPublic } : {}),
        imageUrl: updates.imageUrl,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    return NextResponse.json(pet);
  } catch (error) {
    console.error("Pet PUT error:", error);
    return NextResponse.json(
      { message: "Could not update pet." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { error } = await authorizePetAccess(params.id, userId, role);
    if (error) {
      return error;
    }

    await Pet.findByIdAndDelete(params.id);

    return NextResponse.json({ message: "Deleted" });
  } catch (error) {
    console.error("Pet DELETE error:", error);
    return NextResponse.json(
      { message: "Could not delete pet." },
      { status: 500 }
    );
  }
}
