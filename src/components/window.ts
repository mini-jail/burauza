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

function Window(props: WindowProps) {
  const show = signal(false);
  const fullscreen = signal(false);
  effect(() => show(props.show()));
  effect(() => {
    if (show()) props.onOpen?.();
    else props.onClose?.();
  });

  element("div", (attr) => {
    attr.show = show;
    attr.class = "window";
    attr.fullscreen = fullscreen;
    attr.style = { width: props.width, height: props.height };

    element("div", (attr) => {
      attr.class = "window-title";
      element("h3", (attr) => {
        attr.textContent = props.title;
        attr.title = props.title;
      });

      element("div", (attr) => {
        attr.class = "window-title-children";
        props.titleChildren?.();
        element("button", (attr) => {
          attr.class = () => `icon ${fullscreen() ? "compress" : "enlarge"}`;
          attr.title = () => `${fullscreen() ? "compress" : "enlarge"} window`;
          attr.onClick = () => fullscreen(!fullscreen());
        });
        element("button", (attr) => {
          attr.class = "icon close";
          attr.title = "close window";
          attr.onClick = () => show(false);
        });
      });
    });

    element("div", (attr) => {
      attr.class = "window-content";
      element("div", (attr) => {
        attr.class = "window-content-wrapper";
        props.children?.();
      });
    });
  });
}

export default Window;
