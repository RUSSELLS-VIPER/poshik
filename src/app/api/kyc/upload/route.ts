import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth/auth";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function isEligibleRole(role?: string): boolean {
  return role === "OWNER" || role === "SHOP";
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
        { message: "Only pet owner and shop owner can upload KYC document." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { message: "KYC document file is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_FILE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: "Only PDF, JPG, PNG, and WEBP files are allowed." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: "Document must be 10MB or smaller." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const extension = MIME_EXTENSION_MAP[file.type] ?? "pdf";
    const fileName = `${Date.now()}-${randomUUID()}.${extension}`;
    const uploadDirectory = path.join(process.cwd(), "public", "uploads", "kyc");
    const filePath = path.join(uploadDirectory, fileName);

    await fs.mkdir(uploadDirectory, { recursive: true });
    await fs.writeFile(filePath, fileBuffer);

    return NextResponse.json({
      url: `/uploads/kyc/${fileName}`,
      message: "KYC document uploaded successfully.",
    });
  } catch (error) {
    console.error("KYC upload error:", error);
    return NextResponse.json(
      { message: "Could not upload KYC document." },
      { status: 500 }
    );
  }
}

