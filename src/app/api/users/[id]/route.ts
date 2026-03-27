import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";
import KYC from "@/lib/db/models/KYC";

type RouteContext = {
  params: {
    id: string;
  };
};

const MANAGED_ROLES = new Set(["OWNER", "DOCTOR", "SHOP"]);
const KYC_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

function isValidObjectId(value: string): boolean {
  return mongoose.Types.ObjectId.isValid(value);
}

async function ensureAdminSession() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  const role = session?.user?.role;

  if (!userId) {
    return { error: NextResponse.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  if (role !== "ADMIN") {
    return { error: NextResponse.json({ message: "Forbidden." }, { status: 403 }) };
  }

  return { session };
}

export async function GET(_: Request, { params }: RouteContext) {
  try {
    const auth = await ensureAdminSession();
    if (auth.error) {
      return auth.error;
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid user id." }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(params.id)
      .select("name email role kycStatus emailVerified isActive phone createdAt")
      .lean();

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const latestKyc = await KYC.findOne({ userId: params.id })
      .select("documentUrl status updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ ...user, latestKyc: latestKyc ?? null });
  } catch (error) {
    console.error("User GET by id error:", error);
    return NextResponse.json(
      { message: "Could not fetch user." },
      { status: 500 }
    );
  }
}

async function updateUser(req: Request, params: RouteContext["params"], method: "PATCH" | "PUT") {
  try {
    const auth = await ensureAdminSession();
    if (auth.error) {
      return auth.error;
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid user id." }, { status: 400 });
    }

    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) {
        return NextResponse.json(
          { message: "Name cannot be empty." },
          { status: 400 }
        );
      }
      updates.name = name;
    }

    if (typeof body?.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!email) {
        return NextResponse.json(
          { message: "Email cannot be empty." },
          { status: 400 }
        );
      }
      updates.email = email;
    }

    if (typeof body?.phone === "string") {
      updates.phone = body.phone.trim();
    }

    if (typeof body?.isActive === "boolean") {
      updates.isActive = body.isActive;
    }

    if (typeof body?.kycStatus === "string") {
      const kycStatus = body.kycStatus.trim().toUpperCase();
      if (!KYC_STATUSES.has(kycStatus)) {
        return NextResponse.json(
          { message: "Invalid KYC status." },
          { status: 400 }
        );
      }
      updates.kycStatus = kycStatus;
    }

    if (typeof body?.role === "string") {
      const nextRole = body.role.trim().toUpperCase();
      if (!MANAGED_ROLES.has(nextRole)) {
        return NextResponse.json(
          { message: "Role can be OWNER, DOCTOR, or SHOP only." },
          { status: 400 }
        );
      }
      updates.role = nextRole;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { message: "No valid updates provided." },
        { status: 400 }
      );
    }

    await connectDB();

    const user = await User.findById(params.id).select("role");
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (!MANAGED_ROLES.has(String(user.role))) {
      return NextResponse.json(
        { message: "Cannot manage this user role from this page." },
        { status: 400 }
      );
    }

    if (typeof updates.email === "string") {
      const existingUser = await User.findOne({
        email: updates.email,
        _id: { $ne: params.id },
      })
        .select("_id")
        .lean();

      if (existingUser) {
        return NextResponse.json(
          { message: "Another user already uses this email." },
          { status: 409 }
        );
      }
    }

    const updatedUser = await User.findByIdAndUpdate(params.id, updates, {
      new: true,
      runValidators: true,
    })
      .select("name email role kycStatus emailVerified isActive phone createdAt")
      .lean();

    if (!updatedUser) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (typeof updates.kycStatus === "string") {
      await KYC.findOneAndUpdate(
        { userId: params.id },
        { status: updates.kycStatus },
        { new: true, sort: { updatedAt: -1 } }
      );
    }

    const latestKyc = await KYC.findOne({ userId: params.id })
      .select("documentUrl status updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      message: `User updated successfully via ${method}.`,
      user: { ...updatedUser, latestKyc: latestKyc ?? null },
    });
  } catch (error) {
    console.error(`User ${method} error:`, error);
    return NextResponse.json(
      { message: "Could not update user." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  return updateUser(req, params, "PATCH");
}

export async function PUT(req: Request, { params }: RouteContext) {
  return updateUser(req, params, "PUT");
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const auth = await ensureAdminSession();
    if (auth.error) {
      return auth.error;
    }

    if (!isValidObjectId(params.id)) {
      return NextResponse.json({ message: "Invalid user id." }, { status: 400 });
    }

    await connectDB();

    const user = await User.findById(params.id).select("role");
    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (!MANAGED_ROLES.has(String(user.role))) {
      return NextResponse.json(
        { message: "Cannot delete this user role from this page." },
        { status: 400 }
      );
    }

    await Promise.all([
      KYC.deleteMany({ userId: params.id }),
      User.findByIdAndDelete(params.id),
    ]);

    return NextResponse.json({ message: "User deleted successfully." });
  } catch (error) {
    console.error("User DELETE error:", error);
    return NextResponse.json(
      { message: "Could not delete user." },
      { status: 500 }
    );
  }
}
