import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  serveDir,
  ServeDirOptions,
} from "https://deno.land/std@0.178.0/http/file_server.ts";
import * as esbuild from "https://deno.land/x/esbuild@v0.17.11/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts";

type Path = RegExp;
type Handler = (...args: string[]) => Promise<Response> | Response;
type Route = { method: string; path: Path; handler: Handler };

const dev = Deno.args[0] === "dev";
const dirCfg: ServeDirOptions = { showIndex: true, fsRoot: "./static" };
const routes: Route[] = [];
const { outputFiles } = await esbuild.build({
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
  write: false,
});
const sourceMap = outputFiles[0].text;
const code = outputFiles[1].text;

const headers = {
  json: { "Content-Type": "application/json" },
  text: { "Content-Type": "text/plain" },
  js: { "Content-Type": "application/javascript" },
};

function route(method: string, path: string, handler: Handler) {
  routes.push({
    method,
    path: RegExp(path.replace(/:(\w+)/g, "([^\\/]+)") + "$"),
    handler,
  });
  console.log("added route", routes.at(-1)!.path);
}

function get(path: string, handler: Handler) {
  route("GET", path, handler);
}

get("/app.js", () => new Response(code, { headers: headers.js }));
get("/app.js.map", () => new Response(sourceMap, { headers: headers.json }));

serve((req: Request) => {
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = route.path.exec(req.url);
    if (match !== null) return route.handler(...match.slice(1));
  }

  return serveDir(req, dirCfg);
});
