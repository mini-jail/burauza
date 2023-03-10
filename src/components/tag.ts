import { addElement, component, signal } from "../deps.ts";
import Booru from "../context.ts";
import { useWiki } from "./use-wiki.ts";

export const Tag = component((name: string) => {
  const { toggleTag, tags, highlighted } = Booru;
  const trigger = signal<boolean>(false);
  const wiki = useWiki(name, trigger);
  addElement("div", (attr) => {
    attr.textContent = name;
    attr.class = "tag";
    attr.title = wiki;
    attr.onClick = () => toggleTag(name);
    attr.onMouseOver = () => trigger(true);
    attr.onMouseOut = () => trigger(false);
    attr.state = () => {
      if (tags().includes(name)) return "active";
      else if (highlighted().includes(name)) return "highlight";
    };
  });
});

export default Tag;
