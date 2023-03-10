import { effect, on, signal } from "../deps.ts";

const cache = new Map<string, string>();

export function useWiki(id: string, trigger: () => boolean) {
  const wiki = signal<string>(id);
  effect(on(trigger, () => {
    if (trigger() === false) return wiki(id);
    if (cache.has(id)) return wiki(cache.get(id));
    fetch(`https://danbooru.donmai.us/wiki_pages/${id}.json`)
      .then(async (res) => {
        cache.set(id, res.ok ? (await res.json()).body : id);
      });
  }));
  return wiki;
}
