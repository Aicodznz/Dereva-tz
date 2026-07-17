import fs from 'fs';
import path from 'path';
import { getFirestoreDb } from '../api/_lib/getFirestoreDb.js';

interface RawPlace {
  placeId?: string;
  region?: string;
  district?: string;
  ward?: string;
  streetOrVillage?: string;
  name?: string;
  displayName?: string;
  latitude?: any;
  longitude?: any;
  aliases?: any;
  popularNames?: any;
  searchKeywords?: any;
  category?: string;
}

/**
 * Validates a place object against the strict Stage 1 schema
 */
function validatePlace(p: RawPlace, index: number): string[] {
  const errors: string[] = [];

  if (!p.placeId || typeof p.placeId !== 'string') errors.push(`[Item ${index}] Missing or invalid 'placeId' (must be non-empty string)`);
  if (!p.region || typeof p.region !== 'string') errors.push(`[Item ${index}] Missing or invalid 'region'`);
  if (!p.district || typeof p.district !== 'string') errors.push(`[Item ${index}] Missing or invalid 'district'`);
  if (!p.ward || typeof p.ward !== 'string') errors.push(`[Item ${index}] Missing or invalid 'ward'`);
  if (!p.streetOrVillage || typeof p.streetOrVillage !== 'string') errors.push(`[Item ${index}] Missing or invalid 'streetOrVillage'`);
  if (!p.name || typeof p.name !== 'string') errors.push(`[Item ${index}] Missing or invalid 'name'`);
  if (!p.displayName || typeof p.displayName !== 'string') errors.push(`[Item ${index}] Missing or invalid 'displayName'`);

  const lat = Number(p.latitude);
  const lng = Number(p.longitude);
  if (isNaN(lat) || lat < -90 || lat > 90) errors.push(`[Item ${index}] Missing or invalid 'latitude' (must be between -90 and 90)`);
  if (isNaN(lng) || lng < -180 || lng > 180) errors.push(`[Item ${index}] Missing or invalid 'longitude' (must be between -180 and 180)`);

  if (!Array.isArray(p.aliases)) errors.push(`[Item ${index}] 'aliases' must be an array of strings`);
  if (!Array.isArray(p.popularNames)) errors.push(`[Item ${index}] 'popularNames' must be an array of strings`);
  if (!Array.isArray(p.searchKeywords)) errors.push(`[Item ${index}] 'searchKeywords' must be an array of strings`);

  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: npx tsx scripts/import-places.ts <path-to-json-file>");
    process.exit(1);
  }

  const filePath = path.resolve(args[0]);
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading places from: ${filePath}...`);
  let rawData: any;
  try {
    const rawContent = fs.readFileSync(filePath, 'utf8');
    rawData = JSON.parse(rawContent);
  } catch (err: any) {
    console.error(`Error: Failed to parse JSON file: ${err.message}`);
    process.exit(1);
  }

  const items = Array.isArray(rawData) ? rawData : [rawData];
  console.log(`Found ${items.length} records. Validating...`);

  const allErrors: string[] = [];
  const validPlaces: any[] = [];

  items.forEach((item, idx) => {
    const errors = validatePlace(item, idx);
    if (errors.length > 0) {
      allErrors.push(...errors);
    } else {
      validPlaces.push({
        placeId: item.placeId,
        region: item.region,
        district: item.district,
        ward: item.ward,
        streetOrVillage: item.streetOrVillage,
        name: item.name,
        displayName: item.displayName,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        aliases: item.aliases.map((a: any) => String(a).toUpperCase()),
        popularNames: item.popularNames.map((p: any) => String(p)),
        searchKeywords: item.searchKeywords.map((k: any) => String(k).toUpperCase()),
        category: item.category || 'landmark'
      });
    }
  });

  if (allErrors.length > 0) {
    console.error(`Validation Failed with ${allErrors.length} errors:`);
    allErrors.slice(0, 20).forEach(err => console.error(` - ${err}`));
    if (allErrors.length > 20) {
      console.error(` ... and ${allErrors.length - 20} more errors.`);
    }
    process.exit(1);
  }

  console.log(`Validation Passed! Seeding ${validPlaces.length} places into Firestore...`);
  const db = getFirestoreDb();

  for (const place of validPlaces) {
    try {
      console.log(` - Seeding place: ${place.name} (${place.placeId})`);
      await db.collection('places').doc(place.placeId).set(place);
    } catch (err: any) {
      console.error(`Failed to write place ${place.placeId}: ${err.message}`);
    }
  }

  console.log("Seeding complete! Database is successfully updated.");
  process.exit(0);
}

main().catch(err => {
  console.error("Unhandled exception:", err);
  process.exit(1);
});
