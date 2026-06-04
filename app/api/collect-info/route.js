import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const clientData = await req.json();
    
    // Server-side headers
    const ip = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';
    const acceptLanguage = req.headers.get('accept-language') || 'Unknown';
    const host = req.headers.get('host') || 'localhost';
    
    // Edge Geolocation headers (e.g. from Vercel)
    const country = req.headers.get('x-vercel-ip-country') || 'Local/Unknown';
    const region = req.headers.get('x-vercel-ip-country-region') || 'Local/Unknown';
    const city = req.headers.get('x-vercel-ip-city') || 'Local/Unknown';
    const lat = req.headers.get('x-vercel-ip-latitude') || 'Unknown';
    const lon = req.headers.get('x-vercel-ip-longitude') || 'Unknown';

    const serverData = {
      ip,
      host,
      userAgent,
      acceptLanguage,
      geo: {
        country,
        region,
        city,
        latitude: lat,
        longitude: lon,
      }
    };

    console.log("\n--- [CLIENT PROBE DATA COLLECTED] ---");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Server Connection Info:", JSON.stringify(serverData, null, 2));
    console.log("Client JS Specs Probed:", JSON.stringify(clientData, null, 2));
    console.log("-------------------------------------\n");

    return NextResponse.json({
      success: true,
      message: "Diagnostics received",
      serverData
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
