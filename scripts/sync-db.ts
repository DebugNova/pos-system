import "dotenv/config";
import { menuItems, defaultCategories, defaultModifiers } from "../lib/data";
import { upsertMenuItem, upsertModifier, updateSettingsInDb } from "../lib/supabase-queries";

async function sync() {
  console.log("Syncing categories to settings.menu_categories...");
  try {
    await updateSettingsInDb({ menuCategories: defaultCategories });
    console.log("Categories synced to settings row");
  } catch (e) {
    console.error("Failed to sync categories:", e);
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
