import {
  serve as denoServe,
  ServeInit,
} from "https://deno.land/std@0.177.0/http/server.ts";
import {
  serveDir,
  ServeDirOptions,
} from "https://deno.land/std@0.178.0/http/file_server.ts";
import { refresh } from "https://deno.land/x/refresh@1.0.0/mod.ts";
import { dev } from "./params.ts";

type Path = RegExp;
type Handler = (
  request: Request,
  ...args: string[]
) => Promise<Response> | Response;
type Route = {
  method: string;
  path: Path;
  pathString: string;
  handler: Handler;
};

const dirCfg: ServeDirOptions = { showIndex: true, fsRoot: "./static" };
const routes: Route[] = [];

export function route(method: string, path: string, handler: Handler): void {
  const route = routes.find((route) =>
    route.pathString === path && route.method === method
  );
  if (route) {
    route.handler = handler;
    console.log(`update ${method} ${path}`);
  } else {
    const pathRegExp = RegExp(`${path.replace(/:(\w+)/g, "([^\\/]+)")}$`);
    routes.push({ method, path: pathRegExp, pathString: path, handler });
    console.log(`add ${method} ${path}`);
  }
}

export function get(path: string, handler: Handler): void {
  route("GET", path, handler);
}

export function post(path: string, handler: Handler): void {
  route("POST", path, handler);
}

export function patch(path: string, handler: Handler): void {
  route("PATCH", path, handler);
}

export function del(path: string, handler: Handler): void {
  route("DELETE", path, handler);
}

async function runRoute(request: Request): Promise<Response | null> {
  if (routes.length === 0) return null;
  for (const route of routes) {
    if (route.method !== request.method) continue;
    const match = route.path.exec(request.url);
    if (match !== null) {
      try {
        return await route.handler(request, ...match.slice(1));
      } catch (error) {
        console.error(error);
        return new Response(null, { status: 500 });
      }
    }
  }
  return null;
}

export function serve(options?: ServeInit): void {
  if (dev) {
    const middleware = refresh();
    return void denoServe(async (request) => {
      const routeResponse = await runRoute(request);
      if (routeResponse) return routeResponse;
      const response = middleware(request);
      if (response) return response;
      return serveDir(request, dirCfg);
    }, options);
  }

  denoServe(async (request) => {
    const routeResponse = await runRoute(request);
    if (routeResponse) return routeResponse;
    return serveDir(request, dirCfg);
  }, options);
}
