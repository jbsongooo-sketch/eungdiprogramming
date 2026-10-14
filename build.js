const fs = require("node:fs");
const path = require("node:path");

const outputDir = path.join(__dirname, "dist");
const supabaseUrl = (process.env.SUPABASE_URL || "").trim();
const supabasePublishableKey = (process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY before building.");
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
for (const file of ["index.html", "style.css", "script.js"]) {
  fs.copyFileSync(path.join(__dirname, file), path.join(outputDir, file));
}

const browserConfig = {
  url: supabaseUrl,
  publishableKey: supabasePublishableKey
};
fs.writeFileSync(
  path.join(outputDir, "config.js"),
  `window.SUPABASE_CONFIG = ${JSON.stringify(browserConfig)};\n`,
  "utf8"
);
fs.writeFileSync(path.join(outputDir, ".nojekyll"), "", "utf8");
