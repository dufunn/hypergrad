import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const amapKey = process.env.AMAP_KEY || "";
const amapSecurityCode = process.env.AMAP_SECURITY_JS_CODE || "";

await writeFile(
  resolve(root, "supabase-config.local.js"),
  `window.SUPABASE_CONFIG=${JSON.stringify({ url: supabaseUrl, anonKey: supabaseKey })};\n`,
  "utf8"
);

await writeFile(
  resolve(root, "amap-config.local.js"),
  `window.AMAP_CONFIG=${JSON.stringify({ key: amapKey, securityJsCode: amapSecurityCode })};\n`,
  "utf8"
);

console.log("Runtime config generated.");
