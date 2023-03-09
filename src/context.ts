import { effect, on, scoped, signal } from "./deps.ts"
import { Booru, first, useBooru } from "./components/use-booru.ts"
import { useTitle } from "./components/use-title.ts"

const getHash = () => {
  let hash = location.hash
  if (hash.startsWith("#")) hash = hash.slice(1)
  return hash
}

export default scoped(() => {
  const params = new URLSearchParams(atob(getHash()))
  const initUrl = params.has("url") ? params.get("url")! : first()?.url!
  const initPage = params.has("page") ? ~~params.get("page")! : 1
  const initLimit = params.has("limit") ? ~~params.get("limit")! : 40
  const initSearch = params.has("search") ? params.get("search")! : ""
  const initTags = params.has("tags")
    ? params.get("tags")!.split(",").filter((tag) => tag)
    : []

  const url = signal<string>(initUrl)
  const limit = signal<number>(initLimit)
  const loaded = signal(0)
  const size = signal(Infinity)
  const search = signal<string>(initSearch)
  const highlighted = signal<string[]>([])
  const tags = signal<string[]>(initTags)
  const page = signal(initPage)
  const select = signal<Booru>()
  const posts = useBooru(() => {
    return {
      url: url(),
      limit: limit(),
      page: page(),
      tags: tags(),
    }
  })
  const postTags = () => {
    const tags: string[] = []
    for (const post of posts()) {
      for (const tag of post.tags) {
        if (tags.includes(tag) === false) tags.push(tag)
      }
    }
    return tags.sort((a, b) => {
      if (a < b) return -1
      if (a > b) return 1
      return 0
    })
  }
  const addTag = (tag: string) => !hasTag(tag) && tags([...tags(), tag])
  const delTag = (tag: string) => tags(tags().filter(($) => $ !== tag))
  const toggleTag = (tag: string) => hasTag(tag) ? delTag(tag) : addTag(tag)
  const hasTag = (tag: string) => tags().includes(tag)
  const pageResetTrigger = () => {
    url()
    tags()
  }

  effect(
    on(search, (current: string | undefined) => {
      if (current !== search()) {
        const tags = search().split(" ").filter((value) => value)
        for (const tag of tags) addTag(tag)
        page(1)
      }
      return search()
    }),
    initSearch,
  )

  useTitle(() => {
    let title = `ブラウザ：${page()}`
    if (tags().length) {
      title += ` 「${tags().join("、 ")}」`
    }
    return title
  })

  effect(on(posts, () => {
    size(posts().length)
    loaded(0)
  }))

  effect(
    on(pageResetTrigger, (init) => {
      if (init === false) page(1)
      return false
    }),
    true,
  )

  let paramsId: number
  effect(() => {
    const params = new URLSearchParams()
    if (page()) params.set("page", page().toString())
    if (limit()) params.set("limit", limit().toString())
    if (tags().length) params.set("tags", tags().join(","))
    if (search()) params.set("search", search())
    if (url()) params.set("url", url())
    clearTimeout(paramsId)
    paramsId = setTimeout(() => location.hash = btoa(params.toString()), 500)
  })

  return {
    highlighted,
    tags,
    posts,
    postTags,
    page,
    select,
    addTag,
    delTag,
    hasTag,
    toggleTag,
    search,
    loaded,
    size,
    limit,
    url,
  }
})!
