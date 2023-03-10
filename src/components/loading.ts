import { addElement, render, signal, view } from "../deps.ts";

type LoadingProps = {
  on: () => boolean;
  text: () => string;
};

const loads = signal<Set<LoadingProps>>(new Set());

export function useLoading() {
  let timeoutId: number;
  render(document.body, () => {
    addElement("div", (attr) => {
      attr.style = {
        position: "fixed",
        bottom: "10px",
        right: "10px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        zIndex: "9999",
        pointerEvents: "none",
      };
      view(() => {
        for (const props of loads()) {
          addElement("div", (attr) => {
            attr.class = "loading";
            attr.textContent = props.text;
            attr.loading = () => {
              const result = props.on();
              clearTimeout(timeoutId);
              if (props.on()) {
                loads().delete(props);
                timeoutId = setTimeout(() => loads(($) => $!), 2000);
              }
              return result;
            };
          });
        }
      });
    });
  });
}

export function load(props: LoadingProps) {
  queueMicrotask(() => {
    loads(loads().add(props));
  });
}
