import { NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET, getUniqueCode, isR2Configured } from "@/lib/r2-client";

export async function POST(req) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({
        error: "Supabase connection is not configured. Please add the required environment variables to your .env.local file.",
        isDemo: true,
        code: "9999",
      }, { status: 503 });
    }

    const code = await getUniqueCode();
    const key = `${code}/clipboard.txt`;

    // Upload text content directly to Supabase storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(key, text, {
        contentType: "text/plain; charset=utf-8",
        upsert: true,
      });

    if (error) {
      throw new Error(error.message || "Failed to upload text content to storage");
    }

    return NextResponse.json({
      code,
      key,
    });
  } catch (error) {
    console.error("Text Clipboard Save API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save text clipboard" }, { status: 500 });
  }
}
