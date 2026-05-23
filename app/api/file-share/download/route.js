import { NextResponse } from "next/server";
import { supabase, STORAGE_BUCKET, isR2Configured } from "@/lib/r2-client";

export async function POST(req) {
  try {
    const { code } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const cleanCode = code.trim();

    // Support demo mode for testing UI without environment variables
    if (!isR2Configured()) {
      if (cleanCode === "9999") {
        return NextResponse.json({
          type: "text",
          text: "Hello! This is a demo clipboard message because Supabase is not configured in this environment. Once you configure your Supabase URL and Keys in .env.local, uploads and downloads will work live!",
          fileName: "clipboard.txt",
          isDemo: true,
        });
      }
      return NextResponse.json({
        error: "Supabase connection is not configured. To test the UI locally, try entering code '9999'.",
      }, { status: 503 });
    }

    // List objects in the code's folder in Supabase storage
    const { data: contents, error: listError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(cleanCode, { limit: 5 });

    if (listError) {
      throw listError;
    }

    if (!contents || contents.length === 0) {
      return NextResponse.json({ error: "Invalid code or file has expired." }, { status: 404 });
    }

    // Grab the first file in the directory
    const fileObj = contents[0];
    const fileName = fileObj.name;
    const objectPath = `${cleanCode}/${fileName}`;

    if (fileName === "clipboard.txt") {
      // Fetch text content directly from Supabase Storage
      const { data, error: downloadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .download(objectPath);

      if (downloadError) throw downloadError;

      const text = await data.text();

      return NextResponse.json({
        type: "text",
        text,
        fileName,
      });
    } else {
      // Generate a signed download URL valid for 10 minutes (600 seconds)
      const { data, error: urlError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(objectPath, 600);

      if (urlError) throw urlError;

      return NextResponse.json({
        type: "file",
        downloadUrl: data.signedUrl,
        fileName,
        fileSize: fileObj.metadata?.size || 0,
      });
    }
  } catch (error) {
    console.error("Download API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to lookup code" }, { status: 500 });
  }
}
