import { effect, element, on, signal } from "../deps.ts";

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

  const toggleFullscreen = () => fullscreen(!fullscreen());
  const closeWindow = () => show(false);
  const toggleButtonTitle = () =>
    `${fullscreen() ? "compress" : "enlarge"} window`;
  const toggleButtonClass = () =>
    `icon ${fullscreen() ? "compress" : "enlarge"}`;

  effect(on(props.show, () => show(props.show())));
  effect(on(show, () => show() ? props.onOpen?.() : props.onClose?.()));

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
          class: toggleButtonClass,
          title: toggleButtonTitle,
          onClick: toggleFullscreen,
        });
        element("button", {
          class: "icon close",
          type: "button",
          title: "close window",
          onClick: closeWindow,
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
