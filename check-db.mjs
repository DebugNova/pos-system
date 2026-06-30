import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("Checking Supabase connection to:", supabaseUrl);
  // A simple query to check connection, assuming there's at least one table or just checking auth health
  const { data, error } = await supabase.from('menu_items').select('*').limit(1);
  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('relation "menu_items" does not exist')) {
        console.log("Backend is connected, but menu_items table doesn't exist (which is fine, connection works).");
    } else {
        console.error("Error connecting to backend:", error.message, error);
    }
  } else {
    console.log("Backend is connected successfully!");
  }
}

testConnection();
