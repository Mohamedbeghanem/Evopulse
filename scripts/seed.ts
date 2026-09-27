import { getDb } from "../lib/db";
import { wipeAndSeed } from "../lib/seed";

const db = getDb();
wipeAndSeed(db);
console.log("Seeded Atlas 320K scenario.");
