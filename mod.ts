import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import {
  serveDir,
  ServeDirOptions,
} from "https://deno.land/std@0.178.0/http/file_server.ts"

const dirCfg: ServeDirOptions = { showIndex: true, fsRoot: "./static" }
const routes: Route[] = []
const wikiCache = new Map<string, string>()

type Path = RegExp
type Handler = (...args: string[]) => Promise<Response> | Response
type Route = { path: Path; handler: Handler }

const headers = {
  json: { "Content-Type": "application/json" },
  text: { "Content-Type": "text/plain" },
  js: { "Content-Type": "application/javascript" },
}

function route(path: string, handler: Handler) {
  routes.push({
    path: RegExp(path.replace(/:(\w+)/g, "([^\\/]+)") + "\\/?"),
    handler,
  })
  console.log("added route", routes.at(-1)!.path)
}

route("/api/wiki/:id", async (id) => {
  let body = id
  if (wikiCache.has(id)) body = wikiCache.get(id)!
  else {
    try {
      const response = await fetch(
        `https://danbooru.donmai.us/wiki_pages/${id}.json`,
      )
      if (response.status === 200) {
        const json = await response.json()
        wikiCache.set(id, json.body || id)
      } else {
        wikiCache.set(id, body)
      }
    } catch {
      wikiCache.set(id, body)
    }
    body = wikiCache.get(id)!
  }
  return new Response(body, { headers: { ...headers.text } })
})

serve((req: Request) => {
  for (const route of routes) {
    const match = route.path.exec(req.url)
    if (match !== null) return route.handler(...match.slice(1))
  }

  return serveDir(req, dirCfg)
})
