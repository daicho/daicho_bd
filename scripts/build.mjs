import { fileURLToPath } from "node:url";
import config from "../site.config.mjs";
import { buildSite } from "./site.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const pages = await buildSite({ root, config });
console.log(`Built ${pages.length} Markdown pages in dist.`);
