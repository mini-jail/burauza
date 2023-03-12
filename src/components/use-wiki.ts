import { effect, on, signal } from "../deps.ts";

const cache = new Map<string, string>();

export function useWiki(id: string, trigger: () => boolean) {
  const wiki = signal<string>(id);
  effect(on(trigger, async () => {
    if (trigger() === false) return wiki(id);
    if (cache.has(id)) return wiki(cache.get(id));
    const res = await fetch(`https://danbooru.donmai.us/wiki_pages/${id}.json`);
    if (res.status === 200) {
      cache.set(id, (await res.json()).body);
    } else {
      cache.set(id, id);
    }
  }));
  return wiki;
}
