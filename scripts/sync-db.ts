import "dotenv/config";
require("dotenv").config({ path: ".env.local" });
import { menuItems, defaultCategories, defaultModifiers } from "../lib/data";
import { upsertMenuItem, upsertModifier } from "../lib/supabase-queries";
import { getSupabase } from "../lib/supabase";

async function sync() {
  console.log("Syncing categories...");
  const supabase = getSupabase();
  for (const cat of defaultCategories) {
    const { error } = await supabase.from("categories").upsert(cat);
    if (error) console.error("Category error logs:", error);
  }
  
  console.log("Syncing menu items...");
  for (const item of menuItems) {
    try {
      await upsertMenuItem(item);
      console.log(`Upserted ${item.name}`);
    } catch (e) {
      console.error(`Failed to upsert ${item.name}`, e);
    }
  }

  console.log("Syncing modifiers...");
  for (const mod of defaultModifiers) {
    try {
      await upsertModifier(mod);
      console.log(`Upserted modifier ${mod.name}`);
    } catch (e) {
      console.error(`Failed to upsert modifier ${mod.name}`, e);
    }
  }

  console.log("Sync complete!");
}

sync().catch(console.error);
