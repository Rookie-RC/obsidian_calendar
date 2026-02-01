import esbuild from "esbuild";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("manifest.json", "utf-8"));

const isWatch = process.argv.includes("--watch");

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/main.js",
  sourcemap: "inline",
  format: "cjs",
  platform: "node",
  target: "es2020",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isWatch ? "development" : "production")
  },
  external: ["obsidian"]
});

if (isWatch) {
  await context.watch();
  console.log(`[${manifest.name}] watching...`);
} else {
  await context.rebuild();
  await context.dispose();
  console.log(`[${manifest.name}] build complete`);
}
