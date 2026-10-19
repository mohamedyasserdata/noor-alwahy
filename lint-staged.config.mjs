const quote = (filename) => `"${filename.replaceAll('"', '\\"')}"`;

const projectFiles = (filenames) =>
  filenames.filter((filename) => !filename.replaceAll("\\", "/").includes("/.agents/"));

const commandFor = (command) => (filenames) => {
  const files = projectFiles(filenames);

  return files.length > 0 ? `${command} ${files.map(quote).join(" ")}` : [];
};

const config = {
  "*.{js,mjs,cjs,ts,tsx}": [commandFor("eslint --fix"), commandFor("prettier --write")],
  "*.{css,json,jsonc,md,yml,yaml}": commandFor("prettier --write"),
};

export default config;
