// تحميل .env محليًا عند التطوير (في Docker تأتي المتغيّرات من env_file).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
