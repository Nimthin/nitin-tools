import { NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET, getUniqueCode, isR2Configured } from "@/lib/r2-client";

export async function POST(req) {
  try {
    const { fileName, contentType, fileSize } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({
        error: "Supabase connection is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your .env.local file.",
        isDemo: true,
        code: "9999",
      }, { status: 503 });
    }

    const code = await getUniqueCode();
    // Sanitize filename to avoid folder/path traversal issues
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${code}/${sanitizedName}`;

    // Create a signed upload URL from Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(key);

    if (error) {
      throw new Error(error.message || "Failed to create signed upload URL");
    }

    return NextResponse.json({
      code,
      uploadUrl: data.signedUrl,
      fileName: sanitizedName,
      key,
    });
  } catch (error) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate upload URL" }, { status: 500 });
  }
}
