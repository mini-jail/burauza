interface ReadAsMap {
  readAsArrayBuffer: ArrayBuffer
  readAsBinaryString: string
  readAsDataURL: string
  readAsText: string
}

export function uploadFile<T extends keyof ReadAsMap>(
  accept: string,
  readAs: T,
): Promise<ReadAsMap[T]> {
  return new Promise((res) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.onchange = (ev) => {
      const files = (<any> ev.currentTarget).files
      if (files === null) return
      const reader = new FileReader()
      reader.onload = () => {
        res(<ReadAsMap[T]> reader.result)
      }
      reader[readAs](files[0])
    }
    input.click()
  })
}
