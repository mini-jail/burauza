import { addElement, component, elementRef, onMount, view } from "../deps.ts";
import Booru from "../context.ts";
import { load } from "./loading.ts";

export const Posts = component(() => {
  const { posts, highlighted, select, loaded, size } = Booru;

  addElement("main", (attr) => {
    const ref = elementRef()!;
    attr.ready = () => size() <= loaded();
    view(() => {
      load({
        on: () => size() <= loaded(),
        text: () => `loading posts ${loaded()}/${size()}`,
      });
      onMount(() => ref.scrollTo({ top: 0, behavior: "smooth" }));
      for (const post of posts()) {
        addElement("article", () => {
          addElement("img", (attr) => {
            attr.src = post.previewUrl;
            attr.alt = attr.src;
            attr.onClick = () => select(post);
            attr.onLoad = () => loaded(loaded() + 1);
            attr.onError = attr.onLoad;
            attr.onMouseOver = () => highlighted(post.tags);
            attr.onMouseOut = () => highlighted([]);
          });
        });
      }
    });
  });
});

export default Posts;
