import {
  addElement,
  component,
  computed,
  effect,
  onCleanup,
  signal,
  view,
} from "../deps.ts";
import Booru from "../context.ts";
import Window from "./window.ts";
import Tag from "./tag.ts";
import { load } from "./loading.ts";

export const Preview = component(() => {
  const { select, posts } = Booru;
  const source = signal<string>("");
  const show = signal(false);

  effect(() => {
    const item = select();
    source(item?.fileUrl);
    onCleanup(() => show(false));
  });

  const onKeyUp = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowRight") showNext();
    else if (ev.key === "ArrowLeft") showPrevious();
  };

  const showPrevious = () => {
    const index = posts().indexOf(select()!);
    const prev = (index - 1) === -1 ? posts().length - 1 : index - 1;
    select(posts()[prev]);
  };

  const showNext = () => {
    const index = posts().indexOf(select()!);
    const next = (index + 1) === posts().length ? 0 : index + 1;
    select(posts()[next]);
  };

  Window({
    title: () => String(select()?.fileUrl),
    show: show,
    width: "100vw",
    onOpen: () => addEventListener("keyup", onKeyUp),
    onClose: () => removeEventListener("keyup", onKeyUp),
    titleChildren() {
      addElement("button", (attr) => {
        attr.class = "icon left";
        attr.onClick = showPrevious;
      });
      addElement("button", (attr) => {
        attr.class = "icon right";
        attr.onClick = showNext;
      });
      addElement("button", (attr) => {
        attr.class = "icon curly-arrow";
        attr.title = "open file in new tab";
        attr.onClick = () => open(select()!.fileUrl, "_blank");
      });
    },
    children() {
      addElement("div", (attr) => {
        attr.style = `
          display: flex;
          gap: 10px;
          align-items: flex-start;
        `;
        view(() => {
          const post = select();
          if (post === undefined) return;
          if (source() === undefined) return;
          load({ on: show, text: () => `loading ${post.id}` });

          addElement("img", (attr) => {
            attr.style = `
              object-fit: contain;
              flex: 1;
              width: 500px;
              min-width: 500px;
            `;
            attr.src = source();
            attr.alt = post.fileUrl || "";
            attr.onLoad = () => show(true);
            attr.onError = () => source(post.previewUrl);
          });
          addElement("div", (attr) => {
            attr.style = `
              display: flex;
              gap: 5px;
              flex-wrap: wrap;
            }`;
            for (const tag of post.tags) Tag(tag);
          });
        });
      });
    },
  });
});

export default Preview;
