import { readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const appRoot = resolve(projectRoot, "app");
const forbiddenSegment = /^(messages?|chats?|conversations?|threads?|replies)$/i;

async function findRouteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await findRouteFiles(path)));
    if (entry.isFile() && /^(page|route)\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path);
  }

  return files;
}

const forbiddenRoutes = (await findRouteFiles(appRoot))
  .map((path) => relative(appRoot, path).split(sep))
  .filter((segments) => segments.some((segment) => forbiddenSegment.test(segment)))
  .map((segments) => segments.join("/"));

if (forbiddenRoutes.length > 0) {
  console.error("Internal messaging routes are outside the approved product scope:");
  forbiddenRoutes.forEach((route) => console.error(`- app/${route}`));
  process.exit(1);
}

console.log("No internal messaging routes found.");
