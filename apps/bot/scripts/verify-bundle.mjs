import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const output = join(process.cwd(), "dist", "index.js");
const metafile = join(process.cwd(), "dist", "metafile-esm.json");

if (!existsSync(output) || !existsSync(metafile)) {
  throw new Error("Production build output or dependency graph is missing");
}

const metadata = JSON.parse(readFileSync(metafile, "utf8"));
const bundledInputs = Object.keys(metadata.inputs).map((file) => file.replaceAll("\\", "/"));

for (const directory of ["commands", "events"]) {
  const source = join(process.cwd(), "src", directory);
  const files = readdirSync(source).filter((name) => name.endsWith(".ts"));
  for (const name of files) {
    const expected = `src/${directory}/${name}`;
    if (!bundledInputs.some((input) => input.endsWith(expected))) {
      throw new Error(`Production bundle is missing ${expected}`);
    }
  }
  console.info(`Verified ${files.length} bundled ${directory}`);
}
