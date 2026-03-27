import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import User from "@/lib/db/models/User";
import { hashToken } from "@/lib/utils/tokens";

function loginRedirectUrl(requestUrl: string, state: string) {
  const url = new URL("/login", requestUrl);
  url.searchParams.set("verified", state);
  return url;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const email = searchParams.get("email")?.trim()?.toLowerCase();

  if (!token || !email) {
    return NextResponse.redirect(loginRedirectUrl(req.url, "missing"));
  }

  try {
    await connectDB();

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      email,
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      const alreadyVerified = await User.exists({ email, emailVerified: true });
      return NextResponse.redirect(
        loginRedirectUrl(req.url, alreadyVerified ? "already" : "invalid")
      );
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save();

    return NextResponse.redirect(loginRedirectUrl(req.url, "success"));
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.redirect(loginRedirectUrl(req.url, "error"));
  }
}
