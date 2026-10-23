import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceRoots = ["app", "components", "lib"];
const forbiddenDirectories = ["app/api/ai", "lib/ai"];
const forbiddenPackages = ["@anthropic-ai/sdk", "anthropic", "openai", "@google/generative-ai"];
const forbiddenEnvironmentKeys = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
];
const sourcePatterns = [
  /from\s+["']@anthropic-ai\/sdk["']/u,
  /from\s+["']openai["']/u,
  /require\(["'](?:@anthropic-ai\/sdk|openai)["']\)/u,
  /https:\/\/api\.(?:anthropic|openai)\.com/u,
];

const violations = [];
for (const directory of forbiddenDirectories) {
  if (await exists(directory)) violations.push(`${directory}: forbidden product path`);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
for (const dependency of forbiddenPackages) {
  if (dependency in dependencies)
    violations.push(`package.json: forbidden dependency ${dependency}`);
}

const environment = await readFile(".env.example", "utf8");
for (const key of forbiddenEnvironmentKeys) {
  if (new RegExp(`^${key}=`, "mu").test(environment)) {
    violations.push(`.env.example: forbidden provider key ${key}`);
  }
}

const files = [];
for (const root of sourceRoots) await collect(root, files);
for (const file of files) {
  const contents = await readFile(file, "utf8");
  for (const pattern of sourcePatterns) {
    if (pattern.test(contents)) violations.push(`${file}: forbidden model-provider integration`);
  }
}

if (violations.length) {
  console.error("AI integration guard failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`AI integration guard passed (${files.length} product files scanned).`);
}

async function exists(entry) {
  try {
    await stat(entry);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function collect(entry, result) {
  if (!(await exists(entry))) return;
  const info = await stat(entry);
  if (info.isFile()) {
    if ([".js", ".jsx", ".mjs", ".ts", ".tsx"].includes(path.extname(entry))) result.push(entry);
    return;
  }
  for (const child of await readdir(entry, { withFileTypes: true })) {
    if (child.name.startsWith(".") || child.name === "node_modules") continue;
    await collect(path.join(entry, child.name), result);
  }
}
