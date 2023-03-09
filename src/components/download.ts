export function download(name: string, type: string, data: string): void {
  const encoded = `${type};charset=utf-8,${encodeURIComponent(data)}`
  const a = document.createElement("a")
  a.href = "data:" + encoded
  a.download = name
  a.click()
}
