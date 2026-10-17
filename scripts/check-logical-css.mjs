import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".css"]);
const defaultRoots = ["app", "components", "lib", "tests"];

const physicalUtilityPatterns = [
  /^(?:-)?(?:m[l-r]|p[l-r])-.+$/,
  /^(?:-)?(?:scroll-m[l-r]|scroll-p[l-r])-.+$/,
  /^(?:-)?(?:left|right)-.+$/,
  /^text-(?:left|right)$/,
  /^rounded-(?:l|r|tl|tr|bl|br)(?:-.+)?$/,
  /^border-(?:l|r)(?:-.+)?$/,
  /^(?:float|clear)-(?:left|right)$/,
  /^origin-(?:(?:top|bottom)-)?(?:left|right)$/,
];

const physicalPropertyPatterns = [
  /\b(?:margin|padding|inset|border)-(?:left|right)\b/gu,
  /\bborder-(?:top|bottom)-(?:left|right)-radius\b/gu,
  /\b(?:margin|padding|border)(?:Left|Right)\b/gu,
  /\bborder(?:Top|Bottom)(?:Left|Right)Radius\b/gu,
  /(?<![-\w])(?:left|right)\s*:/gu,
  /\btext-align\s*:\s*(?:left|right)\b/gu,
  /\b(?:float|clear)\s*:\s*(?:left|right)\b/gu,
];

const requestedPaths = process.argv.slice(2);
const roots = requestedPaths.length > 0 ? requestedPaths : defaultRoots;
const files = [];

for (const root of roots) {
  const absoluteRoot = path.resolve(root);

  try {
    await collectFiles(absoluteRoot, files);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      continue;
    }

    throw error;
  }
}

const violations = [];

for (const file of files) {
  const contents = await readFile(file, "utf8");
  const lines = contents.split(/\r?\n/u);

  lines.forEach((line, index) => {
    for (const rawToken of line.matchAll(/[\w!:[\]&>.*=~|^$()/%+-]+/gu)) {
      const token = rawToken[0];
      const utility = token.slice(token.lastIndexOf(":") + 1).replace(/^!/u, "");

      if (physicalUtilityPatterns.some((pattern) => pattern.test(utility))) {
        violations.push({ file, line: index + 1, token });
      }
    }

    for (const pattern of physicalPropertyPatterns) {
      pattern.lastIndex = 0;
      const match = pattern.exec(line);

      if (match) {
        violations.push({ file, line: index + 1, token: match[0] });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Physical-direction CSS utilities are forbidden; use logical utilities instead:");

  for (const violation of violations) {
    console.error(
      `${path.relative(process.cwd(), violation.file)}:${violation.line} ${violation.token}`,
    );
  }

  process.exitCode = 1;
} else {
  console.log(`Logical CSS check passed (${files.length} source files scanned).`);
}

async function collectFiles(entry, result) {
  const entryStat = await stat(entry);

  if (entryStat.isFile()) {
    if (sourceExtensions.has(path.extname(entry))) {
      result.push(entry);
    }

    return;
  }

  for (const child of await readdir(entry, { withFileTypes: true })) {
    if (child.name.startsWith(".") || child.name === "node_modules") {
      continue;
    }

    const childPath = path.join(entry, child.name);

    if (child.isDirectory()) {
      await collectFiles(childPath, result);
    } else if (sourceExtensions.has(path.extname(child.name))) {
      result.push(childPath);
    }
  }
}
