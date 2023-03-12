import {
  addElement,
  component,
  effect,
  onCleanup,
  signal,
  view,
} from "../deps.ts";
import Booru from "../context.ts";
import Window from "./window.ts";
import Tag from "./tag.ts";
import { load } from "./loading.ts";

const imageExtensions: string[] = [
  "jpg",
  "jpeg",
  "bmp",
  "png",
  "gif",
];

const getExtension = (filename: string) => {
  return filename.split(".").at(-1);
};

const isImage = (filename: string) => {
  const ext = getExtension(filename);
  if (ext === undefined) return false;
  return imageExtensions.includes(ext);
};

export const Preview = component(() => {
  const { select, posts } = Booru;
  const show = signal(false);

  effect(() => {
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
    width: "100%",
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
        attr.class = "preview";
        view(() => {
          const post = select();
          if (post === undefined) return;
          load({ on: show, text: () => `loading "${post.id}"` });

          addElement("img", (attr) => {
            attr.class = "preview-img";
            attr.src = isImage(post.fileUrl) ? post.fileUrl : post.previewUrl;
            attr.alt = post.fileUrl;
            attr.onLoad = () => show(true);
            attr.onError = (ev) => {
              if (ev.currentTarget.src === post.fileUrl) {
                ev.currentTarget.src = post.previewUrl;
              }
            };
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
