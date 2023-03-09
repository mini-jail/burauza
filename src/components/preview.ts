import {
  addElement,
  component,
  effect,
  onCleanup,
  signal,
  view,
} from "../deps.ts"
import Booru from "../context.ts"

const PreviewTopBar = component(() => {
  const { select } = Booru

  addElement("div", (attr) => {
    attr.class = "top z-index-1"
    addElement("div", (attr) => {
      attr.class = "title"
      attr.textContent = () => String(select()?.fileUrl)
    })

    addElement("button", (attr) => {
      attr.type = "button"
      attr.class = "icon close"
      attr.onClick = () => select(undefined)
    })
  })
})

const Tags = component(() => {
  const { select, hasTag, addTag } = Booru

  addElement("div", (attr) => {
    attr.class = "preview-tags"
    view(() => {
      const post = select()
      if (post == undefined) return
      for (const tag of post.tags) {
        addElement("span", (attr) => {
          attr.class = "tag"
          attr.textContent = tag
          attr.state = () => hasTag(tag) ? "active" : ""
          attr.onClick = () => addTag(tag)
        })
      }
    })
  })
})

export const Preview = component(() => {
  const { select, size, loaded } = Booru
  const source = signal<string>("")
  const ready = signal(false)

  effect(() => {
    const item = select()
    source(item?.fileUrl)
    onCleanup(() => ready(false))
  })

  addElement("div", (attr) => {
    attr.class = "loading"
    attr.ready = () => size() <= loaded()
    attr.textContent = () => {
      const value = String(Math.floor((loaded() / size()) * 100))
      if (value === "NaN") return "Loading... 0%"
      return "Loading... " + value + "%"
    }
  })

  addElement("div", (attr) => {
    attr.class = "preview"
    attr.active = () => ready() && select() !== undefined
    PreviewTopBar()

    addElement("div", (attr) => {
      attr.class = "preview-content"

      view(() => {
        if (source() === undefined) return
        if (select() === undefined) return
        addElement("img", (attr) => {
          attr.src = source()
          attr.alt = select()!.fileUrl
          attr.onLoad = () => ready(true)
          attr.onError = () => source(select()!.previewUrl)
          attr.onClick = () => open(select()!.fileUrl, "_blank")
        })
      })

      Tags()
    })
  })
})

export default Preview
