import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";
import KYC from "@/lib/db/models/KYC";
import mongoose from "mongoose";
import { hashPassword } from "@/lib/utils/encryption";

const MANAGED_ROLES = new Set(["OWNER", "DOCTOR", "SHOP"]);

function buildTemporaryPassword(): string {
  const randomChunk = Math.random().toString(36).slice(-8);
  return `Poshik@${randomChunk}`;
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

export async function GET(req: Request) {
  try {
    const auth = await ensureAdminSession();
    if (auth.error) {
      return auth.error;
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const rolesParam = searchParams.get("roles") ?? "OWNER,DOCTOR,SHOP";
    const search = (searchParams.get("search") ?? "").trim();

    const roles = rolesParam
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter((value) => MANAGED_ROLES.has(value));

    const query: Record<string, unknown> = {
      role: { $in: roles.length > 0 ? roles : Array.from(MANAGED_ROLES) },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .select("name email role kycStatus emailVerified isActive phone createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((user) => new mongoose.Types.ObjectId(String(user._id)));

    const kycDocs = await KYC.find({ userId: { $in: userIds } })
      .select("userId documentUrl status updatedAt createdAt")
      .sort({ updatedAt: -1 })
      .lean();

    const latestKycByUser = new Map<string, (typeof kycDocs)[number]>();
    for (const kyc of kycDocs) {
      const key = String(kyc.userId);
      if (!latestKycByUser.has(key)) {
        latestKycByUser.set(key, kyc);
      }
    }

    const result = users.map((user) => {
      const latestKyc = latestKycByUser.get(String(user._id));
      return {
        ...user,
        latestKyc: latestKyc
          ? {
              _id: latestKyc._id,
              documentUrl: latestKyc.documentUrl ?? "",
              status: latestKyc.status ?? "PENDING",
              updatedAt: latestKyc.updatedAt,
              createdAt: latestKyc.createdAt,
            }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Users GET error:", error);
    return NextResponse.json(
      { message: "Could not fetch users." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const auth = await ensureAdminSession();
    if (auth.error) {
      return auth.error;
    }

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body?.password === "string" ? body.password.trim() : "";
    const role =
      typeof body?.role === "string" ? body.role.trim().toUpperCase() : "OWNER";

    if (!name || !email) {
      return NextResponse.json(
        { message: "Name and email are required." },
        { status: 400 }
      );
    }

    if (!MANAGED_ROLES.has(role)) {
      return NextResponse.json(
        { message: "Role can be OWNER, DOCTOR, or SHOP only." },
        { status: 400 }
      );
    }

    await connectDB();

    const existingUser = await User.findOne({ email }).select("_id").lean();
    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 }
      );
    }

    const generatedPassword = password || buildTemporaryPassword();
    const user = await User.create({
      name,
      email,
      password: await hashPassword(generatedPassword),
      role,
      emailVerified: true,
      kycStatus: "PENDING",
      isActive: true,
    });

    return NextResponse.json(
      {
        message: "User created successfully.",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          kycStatus: user.kycStatus,
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          phone: user.phone,
          createdAt: user.createdAt,
        },
        temporaryPassword: password ? null : generatedPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Users POST error:", error);
    return NextResponse.json(
      { message: "Could not create user." },
      { status: 500 }
    );
  }
}
