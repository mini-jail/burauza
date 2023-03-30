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
  fileExtension: string;
  previewUrl: string;
  dimensions: [x: number, y: number];
};

type BooruResponse = BooruResponsePost[] | { post: BooruResponsePost[] };

type BooruResponsePost = {
  id: number;
  file_url: string;
  image_width: number;
  image_height: number;
  /** yande.re */
  author: string;
  width: number;
  height: number;
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

const params = new URLSearchParams();

export function useBooru(config: () => Config) {
  const posts = signal<BooruPost[]>([]);
  effect(async () => {
    const { page = 1, limit = 40, url, tags } = config();
    const items: BooruPost[] = [];
    const source = find(url)?.url || url;
    if (source) {
      const api = new URL(source);
      params.set("page", page.toString());
      params.set("limit", limit.toString());
      params.delete("tags");
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
          items.push(createPost(post));
        }
      }
    }
    posts(items);
  });
  return posts;
}

function createPost(post: BooruResponsePost): BooruPost {
  return {
    id: post.id,
    fileUrl: post.file_url,
    fileExtension: String(post.file_url.split(".").at(-1)),
    previewUrl: post.preview_url || post.preview_file_url,
    artist: post.tag_string_artist || undefined,
    tags: getPostTags(post),
    dimensions: getPostDimensions(post),
  };
}

function getPostTags(post: BooruResponsePost): string[] {
  const tags: string[] = [];
  if (post.tags || post.tag_string) {
    tags.push(...(post.tags || post.tag_string).split(" "));
  }
  return tags;
}

function getPostDimensions(post: BooruResponsePost): [x: number, y: number] {
  const dimensionX: number = post.image_width || post.width;
  const dimensionY: number = post.image_height || post.height;
  return [dimensionX, dimensionY];
}
