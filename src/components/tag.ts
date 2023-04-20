import { element, signal } from "../deps.ts";
import ctx from "../context.ts";
import { useWiki } from "./use-wiki.ts";
import { BooruPost } from "./use-booru.ts";

addEventListener("click", (ev: Record<string, any>) => {
  const tagName = ev.target?.dataset?.tag;
  if (tagName) ctx.toggleTag(tagName);
});

function tagState(this: string) {
  if (ctx.tags().includes(this)) return "active";
  else if (ctx.highlighted()?.includes(this)) return "highlight";
  return "inactive";
}

export default function Tag(name: string, post?: BooruPost) {
  const trigger = signal<boolean>(false);
  const wiki = useWiki(name, trigger);
  element("div", {
    class: "tag",
    dataTag: name,
    artist: post?.artist === name,
    onMouseOver: () => trigger(true),
    onMouseOut: () => trigger(false),
    state: tagState.bind(name),
  });
}
