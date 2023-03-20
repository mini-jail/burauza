import { effect, element, signal } from "../deps.ts";

type WindowProps = {
  title: () => string;
  show: () => boolean;
  titleChildren?: () => void;
  children: () => void;
  width?: string;
  height?: string;
  onOpen?: () => void;
  onClose?: () => void;
};

export default function Window(props: WindowProps) {
  const show = signal(false);
  const fullscreen = signal(false);
  effect(() => show(props.show()));
  effect(() => {
    if (show()) props.onOpen?.();
    else props.onClose?.();
  });

  element("div", (div) => {
    div.show = show;
    div.class = "window";
    div.fullscreen = fullscreen;
    div.style = { width: props.width, height: props.height };

    element("div", (div) => {
      div.class = "window-title";
      element("h3", { title: props.title, textContent: props.title });

      element("div", (div) => {
        div.class = "window-title-children";
        props.titleChildren?.();
        element("button", {
          type: "button",
          class: () => `icon ${fullscreen() ? "compress" : "enlarge"}`,
          title: () => `${fullscreen() ? "compress" : "enlarge"} window`,
          onClick: () => fullscreen(!fullscreen()),
        });
        element("button", {
          class: "icon close",
          type: "button",
          title: "close window",
          onClick: () => show(false),
        });
      });
    });

    element("div", (div) => {
      div.class = "window-content";
      element("div", (div) => {
        div.class = "window-content-wrapper";
        props.children?.();
      });
    });
  });
}
