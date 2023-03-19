import { element, signal } from "../deps.ts";
import Booru from "../context.ts";
import { useWiki } from "./use-wiki.ts";
import { BooruPost } from "./use-booru.ts";

export default function Tag(name: string, post?: BooruPost) {
  const { toggleTag, tags, highlighted } = Booru;
  const trigger = signal<boolean>(false);
  const wiki = useWiki(name, trigger);
  element("div", {
    class: "tag",
    title: wiki,
    textContent: name,
    artist: post?.artist === name,
    onClick: () => toggleTag(name),
    onMouseOver: () => trigger(true),
    onMouseOut: () => trigger(false),
    state: () => {
      if (tags().includes(name)) return "active";
      else if (highlighted()?.includes(name)) return "highlight";
    },
  });
}
