import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";
import { hashPassword } from "@/lib/utils/encryption";
import { createEmailVerificationToken } from "@/lib/utils/tokens";
import { sendVerificationEmail } from "@/lib/services/email.service";

const ALLOWED_ROLES = new Set(["OWNER", "DOCTOR", "SHOP", "ADMIN"]);

export async function POST(req: Request) {
  try {
    await connectDB();

    const payload = await req.json();
    const name = payload?.name?.trim();
    const email = payload?.email?.trim()?.toLowerCase();
    const password = payload?.password;
    const role = payload?.role ?? "OWNER";

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ message: "Invalid role." }, { status: 400 });
    }

    const { token, hashedToken, expiresAt } = createEmailVerificationToken();
    const verificationBaseUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXTAUTH_URL ??
      new URL(req.url).origin;
    const verificationLink = `${verificationBaseUrl}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(
      email
    )}`;

    const existing = await User.findOne({ email });
    if (existing) {
      if (existing.emailVerified) {
        return NextResponse.json(
          { message: "User already exists. Please login." },
          { status: 400 }
        );
      }

      existing.name = name;
      existing.password = await hashPassword(password);
      existing.role = role;
      existing.emailVerificationToken = hashedToken;
      existing.emailVerificationExpires = expiresAt;
      await existing.save();

      await sendVerificationEmail({
        to: email,
        name,
        verificationLink,
      });

      return NextResponse.json({
        message:
          "Account already exists but was not verified. We sent a fresh verification link.",
        email,
      });
    }

    await User.create({
      name,
      email,
      password: await hashPassword(password),
      role,
      emailVerified: false,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: expiresAt,
    });

    await sendVerificationEmail({
      to: email,
      name,
      verificationLink,
    });

    return NextResponse.json(
      {
        message:
          "Registration successful. Please check your email and click the verification link.",
        email,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json(
      { message: "Could not register user. Please try again." },
      { status: 500 }
    );
  }
}
