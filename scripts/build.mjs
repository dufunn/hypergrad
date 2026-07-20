import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output = resolve(root, "dist");

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "workspace.css", "app.js", "assets"]) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
}

const jsString = (value) => JSON.stringify(String(value || ""));
await writeFile(
  resolve(output, "supabase-config.local.js"),
  `window.SUPABASE_CONFIG={url:${jsString(process.env.SUPABASE_URL)},anonKey:${jsString(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY)}};\n`,
  "utf8"
);
await writeFile(
  resolve(output, "amap-config.local.js"),
  `window.AMAP_CONFIG={key:${jsString(process.env.AMAP_KEY)},securityJsCode:${jsString(process.env.AMAP_SECURITY_JS_CODE || process.env.AMAP_SECURITY_CODE)}};\n`,
  "utf8"
);
await writeFile(resolve(output, "runtime-config.js"), "/* Config is injected by the static build. */\n", "utf8");

console.log("Built static dashboard in dist/");
