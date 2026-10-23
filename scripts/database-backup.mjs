import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { appendFile, mkdir, open, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";

const mode = process.argv[2];
const magic = Buffer.from("NOORBACKUP1");
const tagLength = 16;
const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64");
const postgresToolContainer = process.env.POSTGRES_TOOL_CONTAINER?.trim();
if (key.length !== 32)
  throw new Error("BACKUP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
if (postgresToolContainer && !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(postgresToolContainer))
  throw new Error("POSTGRES_TOOL_CONTAINER has an invalid container name.");

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (result.status !== 0)
    throw new Error(`${command} failed with status ${result.status ?? "unknown"}.`);
}

function containerPath(prefix) {
  return `/tmp/${prefix}-${process.pid}-${randomBytes(6).toString("hex")}.dump`;
}

function removeContainerFile(path) {
  if (postgresToolContainer) {
    run("docker", ["exec", postgresToolContainer, "rm", "-f", path]);
  }
}

async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

if (mode === "create") {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const outputDirectory = process.env.BACKUP_OUTPUT_DIR?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  if (!outputDirectory || !isAbsolute(outputDirectory))
    throw new Error("BACKUP_OUTPUT_DIR must be absolute.");
  await mkdir(outputDirectory, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "noor-backup-"));
  const plain = join(work, "database.dump");
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const encrypted = resolve(outputDirectory, `noor-alwahy-${stamp}.dump.enc`);
  const containerPlain = postgresToolContainer ? containerPath("noor-backup") : null;
  try {
    const dumpArgs = [
      "--format=custom",
      "--no-owner",
      "--no-acl",
      "--schema=public",
      "--schema=private",
      "--schema=auth",
      "--schema=storage",
      "--schema=supabase_migrations",
      `--dbname=${databaseUrl}`,
      `--file=${containerPlain ?? plain}`,
    ];
    if (postgresToolContainer && containerPlain) {
      run("docker", ["exec", postgresToolContainer, "pg_dump", ...dumpArgs]);
      run("docker", ["cp", `${postgresToolContainer}:${containerPlain}`, plain]);
    } else {
      run("pg_dump", dumpArgs);
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    writeFileSync(encrypted, Buffer.concat([magic, iv]));
    await pipeline(createReadStream(plain), cipher, createWriteStream(encrypted, { flags: "a" }));
    await appendFile(encrypted, cipher.getAuthTag());
    const hash = await sha256File(encrypted);
    const size = (await stat(encrypted)).size;
    writeFileSync(
      `${encrypted}.json`,
      JSON.stringify(
        { file: basename(encrypted), createdAt: new Date().toISOString(), sha256: hash, size },
        null,
        2,
      ),
    );
    process.stdout.write(`Encrypted backup created: ${encrypted}\n`);
  } finally {
    if (containerPlain) removeContainerFile(containerPlain);
    rmSync(work, { recursive: true, force: true });
  }
} else if (mode === "restore") {
  if (process.env.ALLOW_DATABASE_RESTORE !== "staging-drill")
    throw new Error("Set ALLOW_DATABASE_RESTORE=staging-drill.");
  const target = process.env.RESTORE_DATABASE_URL?.trim();
  const source = process.env.BACKUP_FILE?.trim();
  if (!target || !source || !isAbsolute(source))
    throw new Error("RESTORE_DATABASE_URL and absolute BACKUP_FILE are required.");
  if (target === process.env.PRODUCTION_DATABASE_URL?.trim())
    throw new Error("Refusing to restore into PRODUCTION_DATABASE_URL.");
  const work = mkdtempSync(join(tmpdir(), "noor-restore-"));
  const plain = join(work, "database.dump");
  const containerPlain = postgresToolContainer ? containerPath("noor-restore") : null;
  try {
    const metadata = await stat(source);
    const header = Buffer.alloc(magic.length + 12);
    const handle = await open(source, "r");
    await handle.read(header, 0, header.length, 0);
    const tag = Buffer.alloc(tagLength);
    await handle.read(tag, 0, tagLength, metadata.size - tagLength);
    await handle.close();
    if (!header.subarray(0, magic.length).equals(magic))
      throw new Error("Unsupported backup format.");
    const decipher = createDecipheriv("aes-256-gcm", key, header.subarray(magic.length));
    decipher.setAuthTag(tag);
    await pipeline(
      createReadStream(source, { start: header.length, end: metadata.size - tagLength - 1 }),
      decipher,
      createWriteStream(plain),
    );
    const restoreArgs = [
      "--clean",
      "--if-exists",
      "--no-owner",
      "--no-acl",
      `--dbname=${target}`,
      containerPlain ?? plain,
    ];
    if (postgresToolContainer && containerPlain) {
      run("docker", ["cp", plain, `${postgresToolContainer}:${containerPlain}`]);
      run("docker", ["exec", postgresToolContainer, "pg_restore", ...restoreArgs]);
    } else {
      run("pg_restore", restoreArgs);
    }
    process.stdout.write(
      "Restore completed; run the documented validation checklist before approval.\n",
    );
  } finally {
    if (containerPlain) removeContainerFile(containerPlain);
    rmSync(work, { recursive: true, force: true });
  }
} else {
  throw new Error("Usage: node scripts/database-backup.mjs create|restore");
}
