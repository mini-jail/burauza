import { effect, on, scoped, signal } from "./deps.ts";
import { BooruPost, first, useBooru } from "./components/use-booru.ts";
import { useTitle } from "./components/use-title.ts";

const getHash = () => {
  let hash = location.hash;
  if (hash.startsWith("#")) hash = hash.slice(1);
  return hash;
};

const getParams = () => {
  const params = new URLSearchParams(getHash());
  return {
    url: params.has("url") ? params.get("url")! : first()?.url!,
    page: params.has("page") ? ~~params.get("page")! : 1,
    limit: params.has("limit") ? ~~params.get("limit")! : 40,
    search: params.has("search") ? params.get("search")! : "",
    tags: params.has("tags")
      ? params.get("tags")!.split(",").filter((tag) => tag)
      : [],
  };
};

export default scoped(() => {
  const init = getParams();
  const url = signal<string>(init.url);
  const limit = signal<number>(init.limit);
  const loaded = signal(0);
  const size = signal(Infinity);
  const search = signal<string>(init.search);
  const highlighted = signal<string[] | undefined>();
  const tags = signal<string[]>(init.tags);
  const page = signal(init.page);
  const select = signal<BooruPost>();
  const posts = useBooru(() => {
    return {
      url: url(),
      limit: limit(),
      page: page(),
      tags: tags(),
    };
  });
  const postTags = () => {
    const tags: string[] = [];
    for (const post of posts()) {
      for (const tag of post.tags) {
        if (tags.includes(tag) === false) tags.push(tag);
      }
    }
    return tags.sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  };
  const addTag = (tag: string) => !hasTag(tag) && tags([...tags(), tag]);
  const delTag = (tag: string) => tags(tags().filter(($) => $ !== tag));
  const toggleTag = (tag: string) => hasTag(tag) ? delTag(tag) : addTag(tag);
  const hasTag = (tag: string) => tags().includes(tag);
  const pageResetTrigger = () => (url(), tags(), undefined);
  const onPopState = (ev: PopStateEvent) => {
    const params = getParams();
    url(params.url);
    page(params.page);
    limit(params.limit);
    search(params.search);
    tags(params.tags);
  };

  effect(
    on(search, (current: string | undefined) => {
      if (current !== search()) {
        const tags = search().split(" ").filter((value) => value);
        for (const tag of tags) addTag(tag);
        page(1);
      }
      return search();
    }),
    init.search,
  );

  useTitle(() => {
    let title = `ブラウザ：${page()}`;
    if (tags().length) {
      title += ` 「${tags().join("、 ")}」`;
    }
    return title;
  });

  effect(on(posts, () => {
    size(posts().length);
    loaded(0);
  }));

  effect<string, string>(
    on(pageResetTrigger, (current) => {
      const next = `${url()}${tags().join()}`;
      if (current !== next) page(1);
      return next;
    }),
    `${url()}${tags().join()}`,
  );

  effect<URLSearchParams, URLSearchParams>((params) => {
    params.set("page", page().toString());
    params.set("limit", limit().toString());
    params.set("url", url());
    if (search().length) params.set("search", search());
    else params.delete("search");
    if (tags().length) params.set("tags", tags().join(","));
    else params.delete("tags");
    removeEventListener("popstate", onPopState);
    location.hash = params.toString();
    addEventListener("popstate", onPopState);
    return params;
  }, new URLSearchParams(getHash()));

  return {
    highlighted,
    tags,
    posts,
    postTags,
    page,
    select,
    addTag,
    delTag,
    hasTag,
    toggleTag,
    search,
    loaded,
    size,
    limit,
    url,
  };
})!;
