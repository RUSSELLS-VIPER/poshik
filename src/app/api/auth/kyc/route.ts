import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import KYC from "@/lib/db/models/KYC";
import User from "@/lib/db/models/User";
import { notifyKycStatusChange } from "@/lib/notifications/status";

function isEligibleRole(role?: string): boolean {
  return role === "OWNER" || role === "SHOP";
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const kyc = await KYC.findOne({ userId }).sort({ createdAt: -1 });

    return NextResponse.json({
      eligible: isEligibleRole(role),
      role,
      kyc,
    });
  } catch (error) {
    console.error("KYC GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch KYC status." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!isEligibleRole(role)) {
      return NextResponse.json(
        { message: "Only pet owner and shop owner can apply for KYC." },
        { status: 403 }
      );
    }

    const payload = await req.json();
    const documentUrl =
      typeof payload?.documentUrl === "string" ? payload.documentUrl.trim() : "";

    if (!documentUrl) {
      return NextResponse.json(
        { message: "Document URL is required." },
        { status: 400 }
      );
    }

    await connectDB();

    const kyc = await KYC.findOneAndUpdate(
      { userId },
      {
        userId,
        documentUrl,
        status: "PENDING",
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    await User.findByIdAndUpdate(userId, { kycStatus: "PENDING" });

    try {
      await notifyKycStatusChange({
        userId,
        status: "PENDING",
        actorRole: role,
      });
    } catch (notificationError) {
      console.error("KYC notification error:", notificationError);
    }

    return NextResponse.json({
      message: "KYC submitted successfully.",
      kyc,
    });
  } catch (error) {
    console.error("KYC POST error:", error);
    return NextResponse.json({ error: "KYC failed" }, { status: 500 });
  }
}
