import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const doctors = await User.find({ role: "DOCTOR" })
      .select("_id name email phone bio")
      .sort({ name: 1 });

    return NextResponse.json(doctors);
  } catch (error) {
    console.error("Doctors GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch doctors." },
      { status: 500 }
    );
  }
}
