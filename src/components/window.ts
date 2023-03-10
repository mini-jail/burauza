import { addElement, component, effect, signal, view } from "../deps.ts";

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

function Window(props: WindowProps): WindowProps {
  const show = signal(false);
  const fullscreen = signal(false);
  effect(() => show(props.show()));
  effect(() => {
    if (show()) props.onOpen?.();
    else props.onClose?.();
  });

  addElement("div", (attr) => {
    attr.show = show;
    attr.class = "window";
    attr.fullscreen = fullscreen;
    attr.style = { width: props.width, height: props.height };

    addElement("div", (attr) => {
      attr.class = "window-title";
      addElement("h3", (attr) => {
        attr.textContent = props.title;
        attr.title = props.title;
      });

      addElement("div", (attr) => {
        attr.class = "window-title-children";
        if (props.titleChildren) {
          view(props.titleChildren);
        }
        addElement("button", (attr) => {
          attr.class = () => `icon ${fullscreen() ? "compress" : "enlarge"}`;
          attr.title = () => `${fullscreen() ? "compress" : "enlarge"} window`;
          attr.onClick = () => fullscreen(!fullscreen());
        });
        addElement("button", (attr) => {
          attr.class = "icon close";
          attr.title = "close window";
          attr.onClick = () => show(false);
        });
      });
    });

    addElement("div", (attr) => {
      attr.class = "window-content";
      addElement("div", (attr) => {
        attr.class = "window-content-wrapper";
        view(props.children);
      });
    });
  });

  return props;
}

export default component(Window);
