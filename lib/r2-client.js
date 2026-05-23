import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
export const STORAGE_BUCKET = "dino-transfers";

export function isR2Configured() {
  // Keeping name compatible for routes, checks if Supabase is initialized
  return !!supabase;
}

// Generate a random 4-digit numeric code
export function generate4DigitCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Ensure the Supabase Storage bucket exists
export async function ensureBucketExists() {
  if (!supabase) return;
  try {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) throw listError;
    
    const exists = buckets?.some(b => b.name === STORAGE_BUCKET);
    if (!exists) {
      const { error: createError } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false,
      });
      if (createError) throw createError;
    }
  } catch (error) {
    console.error("Error verifying or creating Supabase bucket:", error);
  }
}

// Generate a unique 4-digit code not currently in use
export async function getUniqueCode() {
  if (!supabase) {
    return generate4DigitCode();
  }
  
  await ensureBucketExists();
  
  let attempts = 0;
  while (attempts < 10) {
    const code = generate4DigitCode();
    try {
      // List objects in the code folder to check if it's empty
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(code, { limit: 1 });
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return code; // Free code found
      }
    } catch (error) {
      console.error("Error checking code uniqueness in Supabase:", error);
      return code;
    }
    attempts++;
  }
  throw new Error("Could not generate a unique code after 10 attempts");
}
