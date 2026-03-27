import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const user = await User.findById(userId)
      .select("name email role kycStatus phone address bio")
      .lean();

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch profile." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    const updates = {
      name: typeof payload?.name === "string" ? payload.name.trim() : undefined,
      phone:
        typeof payload?.phone === "string" ? payload.phone.trim() : undefined,
      address:
        typeof payload?.address === "string"
          ? payload.address.trim()
          : undefined,
      bio: typeof payload?.bio === "string" ? payload.bio.trim() : undefined,
    };

    if (!updates.name) {
      return NextResponse.json(
        { message: "Name is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findByIdAndUpdate(
      userId,
      {
        name: updates.name,
        phone: updates.phone ?? "",
        address: updates.address ?? "",
        bio: updates.bio ?? "",
      },
      {
        new: true,
        runValidators: true,
      }
    )
      .select("name email role kycStatus phone address bio")
      .lean();

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { message: "Could not update profile." },
      { status: 500 }
    );
  }
}
