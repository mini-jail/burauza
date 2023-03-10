import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  serveDir,
  ServeDirOptions,
} from "https://deno.land/std@0.178.0/http/file_server.ts";

const dirCfg: ServeDirOptions = { showIndex: true, fsRoot: "./static" };
const routes: Route[] = [];

type Path = RegExp;
type Handler = (...args: string[]) => Promise<Response> | Response;
type Route = { method: string; path: Path; handler: Handler };

const headers = {
  json: { "Content-Type": "application/json" },
  text: { "Content-Type": "text/plain" },
  js: { "Content-Type": "application/javascript" },
};

function route(method: string, path: string, handler: Handler) {
  routes.push({
    method,
    path: RegExp(path.replace(/:(\w+)/g, "([^\\/]+)") + "\\/?"),
    handler,
  });
  console.log("added route", routes.at(-1)!.path);
}

serve((req: Request) => {
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const match = route.path.exec(req.url);
    if (match !== null) return route.handler(...match.slice(1));
  }

  return serveDir(req, dirCfg);
});
