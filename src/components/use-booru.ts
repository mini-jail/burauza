import { effect, scoped, signal } from "../deps.ts";

const globalSources = await getGlobalSources();
export const localSources = signal<Source[]>(getLocalSources());

const sources = scoped(() => {
  const sources = () => [...globalSources, ...localSources()];
  effect((init) => {
    const sources = localSources();
    if (init === true) return false;
    localStorage.setItem("sources", JSON.stringify(sources));
  }, true);
  return sources;
})!;

export type Source = {
  name: string;
  url: string;
};

function getLocalSources(): Source[] {
  const initSources = localStorage.getItem("sources") || "[]";
  try {
    return JSON.parse(initSources);
  } catch {
    return [];
  }
}

async function getGlobalSources(): Promise<Source[]> {
  try {
    return await (await fetch("./sources.json")).json();
  } catch {
    return [];
  }
}

export function getSources(): Source[] {
  return sources();
}

export function find(url: string): Source | undefined {
  return sources().find((source) => source.url === url);
}

export function first(): Source | undefined {
  return sources()[0];
}

type Config = {
  url: string;
  limit?: number;
  page?: number;
  tags?: string[];
};

export type BooruPost = {
  id: number;
  artist: string | undefined;
  tags: string[];
  fileUrl: string;
  previewUrl: string;
  source: string;
};

type BooruResponse = BooruResponsePost[] | { post: BooruResponsePost[] };

type BooruResponsePost = {
  id: number;
  file_url: string;
  /** yande.re */
  author: string;
  /** danbooru.donmai.us only */
  tag_string_artist: string;
  /** danbooru.donmai.us only */
  tag_string: string;
  /** yande.re */
  tags: string;
  /** yande.re */
  preview_url: string;
  /** danbooru.donmai.us */
  preview_file_url: string;
};

export function useBooru(config: () => Config) {
  const posts = signal<BooruPost[]>([]);
  effect(async () => {
    const { page = 1, limit = 40, url, tags } = config();
    const items: BooruPost[] = [];
    const source = find(url)?.url || url;
    if (source) {
      const api = new URL(source);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      if (tags?.length) params.set("tags", tags.join(" "));
      api.search = params.toString();
      const response = await fetch(api);
      if (response.ok) {
        const json: BooruResponse = await response.json();
        for (const post of (Array.isArray(json) ? json : json.post) || []) {
          if (post.id === undefined) {
            continue;
          }
          if (post.file_url === undefined) {
            continue;
          }
          if (
            post.preview_url === undefined &&
            post.preview_file_url === undefined
          ) {
            continue;
          }
          items.push(normalizePost(url, post));
        }
      }
    }
    posts(items);
  });
  return posts;
}

function normalizePost(url: string, post: BooruResponsePost): BooruPost {
  const item: BooruPost = {
    id: post.id,
    fileUrl: post.file_url,
    previewUrl: post.preview_url || post.preview_file_url,
    artist: post.tag_string_artist || undefined,
    tags: [],
    source: url,
  };
  const tags = post.tags || post.tag_string;
  if (tags) {
    item.tags.push(...tags.split(" ").filter((value) => value));
  }
  return item;
}
