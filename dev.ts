import * as esbuild from "https://deno.land/x/esbuild@v0.17.11/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts";

const dev = Deno.args[0] === "dev";
await esbuild.build({
  plugins: [<any> denoPlugin()],
  entryPoints: ["./src/app.ts"],
  bundle: true,
  outfile: "./static/app.js",
  format: "esm",
  minify: !dev,
  minifySyntax: !dev,
  minifyIdentifiers: !dev,
  minifyWhitespace: !dev,
  sourcemap: true,
});

esbuild.stop();
