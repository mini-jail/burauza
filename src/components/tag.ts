import { element, signal } from "../deps.ts";
import Booru from "../context.ts";
import { useWiki } from "./use-wiki.ts";
import { BooruPost } from "./use-booru.ts";

addEventListener("click", (ev: Record<string, any>) => {
  const tagName = ev.target?.dataset?.tag;
  if (tagName) Booru.toggleTag(tagName);
});

function tagState(this: string) {
  if (Booru.tags().includes(this)) return "active";
  else if (Booru.highlighted()?.includes(this)) return "highlight";
  return "inactive";
}

export default function Tag(name: string, post?: BooruPost) {
  const trigger = signal<boolean>(false);
  const wiki = useWiki(name, trigger);
  element("div", {
    class: "tag",
    title: wiki,
    dataTag: name,
    artist: post?.artist === name,
    onMouseOver: () => trigger(true),
    onMouseOut: () => trigger(false),
    state: tagState.bind(name),
  });
}
