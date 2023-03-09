import { effect, signal } from "../deps.ts"

export function useWiki(query: () => string | undefined) {
  const cache = new Map<string, string | undefined>()
  const wiki = signal<string>()
  effect(async () => {
    const title = query()
    if (title) {
      if (cache.has(title)) return wiki(cache.get(title))
      const response = await fetch(`/api/wiki/${title}`)
      if (response.status === 200) {
        cache.set(title, await response.text())
        return wiki(cache.get(title))
      }
    }
    wiki(undefined)
  })
  return wiki
}
