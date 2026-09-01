import type { FileAttachment } from "@/types/agent"

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MAX_TEXT_BYTES = 2 * 1024 * 1024

const TEXT_EXT = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "csv",
  "tsv",
  "xml",
  "html",
  "htm",
  "css",
  "scss",
  "less",
  "js",
  "jsx",
  "ts",
  "tsx",
  "mjs",
  "cjs",
  "go",
  "py",
  "rs",
  "java",
  "kt",
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "cs",
  "rb",
  "php",
  "swift",
  "scala",
  "sh",
  "bash",
  "zsh",
  "fish",
  "sql",
  "graphql",
  "yml",
  "yaml",
  "toml",
  "ini",
  "cfg",
  "conf",
  "env",
  "log",
  "diff",
  "patch",
])

export interface ContentPart {
  type: string
  text?: string
  image_url?: { url: string }
}

export type AttachErrorCode = "unsupported" | "too_large" | "read_failed"

export interface AttachError {
  code: AttachErrorCode
  name: string
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/")
}

export function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) return true
  if (
    file.type === "application/json" ||
    file.type === "application/xml" ||
    file.type === "application/javascript" ||
    file.type === "application/yaml" ||
    file.type === "application/x-yaml" ||
    file.type === "application/toml"
  ) {
    return true
  }
  const ext = extensionOf(file.name)
  return ext !== "" && TEXT_EXT.has(ext)
}

export function sanitizeFileName(name: string): string {
  return (
    name
      .replace(/[\r\n]+/g, " ")
      .replaceAll(">>>", "")
      .trim() || "file"
  )
}

export function encodeFileBlock(name: string, text: string): string {
  return `\n\n<<<FILE ${sanitizeFileName(name)}>>>\n${text}\n<<<END FILE>>>`
}

export function parseFileBlocks(content: string): {
  text: string
  files: Extract<FileAttachment, { kind: "text" }>[]
} {
  const files: Extract<FileAttachment, { kind: "text" }>[] = []
  const re = /\n\n<<<FILE (.+?)>>>\n([\s\S]*?)\n<<<END FILE>>>/g
  const stripped = content.replace(re, (_full, name: string, body: string) => {
    files.push({ kind: "text", name, text: body })
    return ""
  })
  return { text: stripped.trim(), files }
}

export function buildSendPrompt(
  text: string,
  attachments: FileAttachment[]
): string {
  let prompt = text
  for (const item of attachments) {
    if (item.kind === "text") prompt += encodeFileBlock(item.name, item.text)
  }
  if (!prompt.trim() && attachments.some((item) => item.kind === "image")) {
    return " "
  }
  return prompt
}

export function imagesFromAttachments(
  attachments: FileAttachment[] | undefined
): { dataUrl: string; name: string }[] | undefined {
  if (!attachments?.length) return undefined
  const images = attachments
    .filter((item): item is Extract<FileAttachment, { kind: "image" }> => {
      return item.kind === "image"
    })
    .map((item) => ({ dataUrl: item.dataUrl, name: item.name }))
  return images.length > 0 ? images : undefined
}

export function parseUserContent(
  content: string,
  parts?: ContentPart[]
): { text: string; attachments: FileAttachment[] } {
  const source = textFromParts(parts) ?? content
  const parsed = parseFileBlocks(source)
  const images = imagesFromParts(parts)
  return { text: parsed.text, attachments: [...images, ...parsed.files] }
}

export async function readFiles(
  files: File[]
): Promise<{ ok: FileAttachment[]; errors: AttachError[] }> {
  const ok: FileAttachment[] = []
  const errors: AttachError[] = []
  for (const file of files) {
    const result = await readOneFile(file)
    if ("error" in result) errors.push(result.error)
    else ok.push(result)
  }
  return { ok, errors }
}

async function readOneFile(
  file: File
): Promise<FileAttachment | { error: AttachError }> {
  if (isImageFile(file)) return readImage(file)
  if (isTextFile(file)) return readText(file)
  return { error: { code: "unsupported", name: file.name } }
}

async function readImage(
  file: File
): Promise<FileAttachment | { error: AttachError }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: { code: "too_large", name: file.name } }
  }
  try {
    const dataUrl = await readAs("data-url", file)
    return { kind: "image", name: file.name, dataUrl }
  } catch {
    return { error: { code: "read_failed", name: file.name } }
  }
}

async function readText(
  file: File
): Promise<FileAttachment | { error: AttachError }> {
  if (file.size > MAX_TEXT_BYTES) {
    return { error: { code: "too_large", name: file.name } }
  }
  try {
    const text = await readAs("text", file)
    return { kind: "text", name: file.name, text }
  } catch {
    return { error: { code: "read_failed", name: file.name } }
  }
}

function extensionOf(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name
  const dot = base.lastIndexOf(".")
  if (dot <= 0 || dot === base.length - 1) return ""
  return base.slice(dot + 1).toLowerCase()
}

function textFromParts(parts?: ContentPart[]): string | undefined {
  if (!parts?.length) return undefined
  const texts = parts
    .filter(
      (part): part is ContentPart & { text: string } =>
        part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
  return texts.length > 0 ? texts.join("\n") : undefined
}

function imagesFromParts(parts?: ContentPart[]): FileAttachment[] {
  if (!parts?.length) return []
  const images: FileAttachment[] = []
  for (const part of parts) {
    if (part.type !== "image_url" || !part.image_url?.url) continue
    images.push({
      kind: "image",
      name: `image-${images.length + 1}`,
      dataUrl: part.image_url.url,
    })
  }
  return images
}

function readAs(mode: "data-url" | "text", file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("empty"))
    }
    reader.onerror = () => reject(reader.error ?? new Error("read"))
    if (mode === "data-url") reader.readAsDataURL(file)
    else reader.readAsText(file)
  })
}
