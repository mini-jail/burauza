import Booru from "../context.ts"
import {
  addElement,
  attributesRef,
  component,
  elementRef,
  onMount,
  Signal,
  signal,
  view,
} from "../deps.ts"
import { useWiki } from "./use-wiki.ts"
import { getSources, localSources, Source } from "./use-booru.ts"
import { usePervert } from "./use-pervert.ts"
import { uploadFile } from "./upload.ts"
import { download } from "./download.ts"

const Navigation = component(() => {
  const { postTags, tags } = Booru
  const query = signal<string>("")
  const wiki = useWiki(query)
  const sourceEdit = signal(false)

  addElement("nav", () => {
    const ref = elementRef()!

    view(() => {
      addElement("div", (attr) => {
        addElement("div", (attr) => {
          attr.class = "flex bg-accent-2 align-items-center sticky-top"
          addElement("h2", (attr) => {
            attr.class = "flex-1 padding-10"
            attr.textContent = "source editor"
          })

          addElement("button", (attr) => {
            attr.class = "icon download-json"
            attr.title = "download sources"
            attr.onClick = () => {
              download(
                `sources-${Date.now()}.json`,
                "application/json",
                JSON.stringify(localSources(), null, 2),
              )
            }
          })
          addElement("button", (attr) => {
            attr.class = "icon close"
            attr.title = "close editor"
            attr.onClick = () => sourceEdit(false)
          })
        })

        attr.class = "source-editor z-index-1"
        attr.open = sourceEdit
        for (const source of localSources()) {
          SourceEdit(source)
        }
        AddSource()
      })
    })

    addElement("div", (attr) => {
      attr.class = "nav-top"
      Inputs(sourceEdit)
      Paging()
      view(() => {
        for (const tag of tags()) {
          addElement("div", () => tagAttributes(tag, query, wiki))
        }
      })
    })

    addElement("div", (attr) => {
      attr.class = "tags"
      view(() => {
        onMount(() => ref.scrollTo({ top: 0, behavior: "smooth" }))
        const selTags = tags()
        for (const tag of postTags().filter((tag) => !selTags.includes(tag))) {
          addElement("div", () => tagAttributes(tag, query, wiki))
        }
      })
    })
  })
})

export default Navigation

function tagAttributes(
  tag: string,
  query: Signal<string>,
  wiki: Signal<string | undefined>,
): void {
  const { toggleTag, tags, highlighted } = Booru
  const attr = attributesRef()!
  let mouseId: number
  attr.textContent = tag
  attr.class = "tag"
  attr.title = () => tag === query() ? wiki() || tag : tag
  attr.onClick = () => toggleTag(tag)
  attr.onMouseOver = () => {
    clearTimeout(mouseId)
    mouseId = setTimeout(() => query(tag), 500)
  }
  attr.onMouseOut = () => {
    clearTimeout(mouseId)
    query(undefined)
  }
  attr.state = () => {
    if (tags().includes(tag)) return "active"
    else if (highlighted().includes(tag)) return "highlight"
  }
}

const Inputs = component((sourceEdit: Signal<boolean>) => {
  const { search, url } = Booru
  const pervert = usePervert()

  addElement("div", (attr) => {
    attr.class = "flex align-items-center"

    view(() => {
      if (pervert()) {
        addElement("button", (attr) => {
          attr.title = "choose image source"
          attr.name = "source"
          attr.type = "button"
          attr.class = "icon source z-index-1"
          addElement("div", (attr) => {
            attr.class = "sources"
            addElement("div", (attr) => {
              attr.title = "open source editor"
              attr.textContent = "source editor"
              attr.onClick = () => sourceEdit(!sourceEdit())
            })
            for (const source of getSources()) {
              addElement("div", (attr) => {
                attr.active = () => source.url === url()
                attr.textContent = source.name
                attr.onClick = () => url(source.url)
              })
            }
          })
        })
      }
    })

    addElement("button", (attr) => {
      attr.title = "browse source"
      attr.name = "sourcecode"
      attr.type = "button"
      attr.class = "icon sourcecode"
      attr.onClick = () => {
        open("https://github.com/mini-jail/burauza", "_blank")
      }
    })

    addElement("input", (attr) => {
      attr.class = "flex-1"
      attr.name = "search"
      attr.placeholder = "search..."
      attr.value = search
      attr.type = "text"
      let id: number
      attr.onInput = (ev) => {
        ev.stopImmediatePropagation()
        ev.stopPropagation()
        const value = ev.currentTarget.value
        clearTimeout(id)
        id = setTimeout(() => search(value), 1000)
      }
    })
  })
})

const Paging = component(() => {
  const { page } = Booru

  addElement("div", (attr) => {
    attr.class = "nav-paging"
    addElement("button", (attr) => {
      attr.class = "previous"
      attr.textContent = () => String(page() - 1)
      attr.disabled = () => page() <= 1
      attr.onClick = () => page(page() - 1)
    })
    addElement("button", (attr) => {
      attr.class = "current"
      attr.disabled = true
      attr.textContent = () => String(page())
    })
    addElement("button", (attr) => {
      attr.class = "next"
      attr.textContent = () => String(page() + 1)
      attr.onClick = () => page(page() + 1)
    })
  })
})

const AddSource = component(() => {
  const name = signal("")
  const url = signal("")

  addElement("div", (attr) => {
    attr.class = "flex padding-10"

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline"
      addElement("label", (attr) => attr.textContent = "name:")
      addElement("input", (attr) => {
        attr.class = "flex-1"
        attr.name = "name"
        attr.value = name
        attr.onInput = (ev) => name(ev.currentTarget.value)
        attr.placeholder = "*Booru"
      })
    })

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline"
      addElement("label", (attr) => attr.textContent = "url:")
      addElement("input", (attr) => {
        attr.class = "flex-1"
        attr.name = "url"
        attr.value = url
        attr.onInput = (ev) => url(ev.currentTarget.value)
        attr.placeholder = "https://..."
      })
    })

    addElement("button", (attr) => {
      attr.class = "icon plus"
      attr.title = "add source"
      attr.disabled = () => !name() || !url()
      attr.onClick = () => {
        if (!name() || !url()) return
        localSources(
          localSources().concat({
            name: name(),
            url: url(),
          }),
        )
        url("")
        name("")
      }
    })

    addElement("button", (attr) => {
      attr.class = "icon import"
      attr.title = "import source"
      attr.onClick = async () => {
        const data = await uploadFile(".json", "readAsText")
        const json = JSON.parse(data)
        const importedSources: Source[] = []
        if (Array.isArray(json)) {
          for (const source of json) {
            if (source.name && source.url) {
              importedSources.push(source)
            }
          }
        }
        localSources(localSources().concat(importedSources))
      }
    })
  })
})

const SourceEdit = component((source: Source) => {
  addElement("div", (attr) => {
    attr.class = "flex justify-content-center padding-10"

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline"
      addElement("label", (attr) => attr.textContent = "name:")
      addElement("input", (attr) => {
        attr.class = "flex-1"
        attr.name = "name"
        attr.value = source.name
        attr.placeholder = "*Booru"
        attr.onInput = (ev) => source.name = ev.currentTarget.value
      })
    })

    addElement("div", (attr) => {
      attr.class = "flex align-items-baseline"
      addElement("label", (attr) => attr.textContent = "url:")
      addElement("input", (attr) => {
        attr.class = "flex-1"
        attr.value = source.url
        attr.placeholder = "https://..."
        attr.onInput = (ev) => source.url = ev.currentTarget.value
      })
    })

    addElement("button", (attr) => {
      attr.class = "icon check"
      attr.title = "save source"
      attr.onClick = () => {
        const newSource = { url: source.url, name: source.name }
        localSources(
          localSources()
            .filter(($) => $ !== source)
            .concat(newSource),
        )
      }
    })

    addElement("button", (attr) => {
      attr.class = "icon delete"
      attr.title = "delete source"
      attr.onClick = () => {
        localSources(localSources().filter(($) => $ !== source))
      }
    })
  })
})
