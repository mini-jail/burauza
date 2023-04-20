import { dev, prod } from "./params.ts";
import {
  build,
  BuildOptions,
  Loader,
  Plugin,
} from "https://deno.land/x/esbuild@v0.17.11/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts";
import mime from "./mime-db.json" assert { type: "json" };
import { get } from "./server.ts";

export const loader: Record<string, Loader> = {
  ".css": "css",
  ".png": "file",
  ".gif": "file",
  ".jpg": "file",
  ".jpeg": "file",
  ".webm": "file",
  ".webp": "file",
};
export const injections: string[] = [];

const options: BuildOptions = {
  plugins: [denoPlugin() as unknown as Plugin],
  entryPoints: ["./src/app.ts"],
  inject: injections,
  outfile: "./static/app.js",
  loader: loader,
  bundle: true,
  format: "esm",
  minify: !dev,
  minifySyntax: !dev,
  minifyIdentifiers: !dev,
  minifyWhitespace: !dev,
  sourcemap: true,
  write: !dev,
};

if (prod) {
  await build(options);
}

if (dev) {
  let built = false;
  injections.push(
    "https://raw.githubusercontent.com/cmorten/refresh/main/client.js",
  );
  await virtualizeFiles();
  for await (const { kind } of Deno.watchFs("./src")) {
    if (["access", "other"].includes(kind)) continue;
    else if (built === true) continue;
    await virtualizeFiles();
    built = true;
    setTimeout(() => built = false, 500);
  }
}

async function virtualizeFiles() {
  const files = (await build(options)).outputFiles!;
  for (const file of files) {
    const path = file.path.split("/").at(-1);
    if (!path) continue;
    const ext = path.split(".").at(-1) || "buffer";
    const contentType = (<Record<string, string>> mime)[ext];
    get(path, () => {
      return new Response(file.contents, {
        headers: { "Content-Type": contentType },
        status: 200,
      });
    });
  }
}
