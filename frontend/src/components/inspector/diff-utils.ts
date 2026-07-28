/** DiffLine is one row of a line-based diff. */
export interface DiffLine {
  type: "add" | "del" | "ctx"
  text: string
  oldNo?: number
  newNo?: number
}

const MAX_DIFF_CELLS = 250_000

/** diffLines computes a line-based LCS diff between two texts. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText === "" ? [] : oldText.split("\n")
  const b = newText === "" ? [] : newText.split("\n")
  const m = a.length
  const n = b.length

  // Fallback for oversized inputs: no alignment, just del-all + add-all.
  if (m * n > MAX_DIFF_CELLS) {
    return [
      ...a.map((text, i) => ({ type: "del" as const, text, oldNo: i + 1 })),
      ...b.map((text, i) => ({ type: "add" as const, text, newNo: i + 1 })),
    ]
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  let oldNo = 1
  let newNo = 1
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ type: "ctx", text: a[i], oldNo: oldNo++, newNo: newNo++ })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i], oldNo: oldNo++ })
      i++
    } else {
      out.push({ type: "add", text: b[j], newNo: newNo++ })
      j++
    }
  }
  while (i < m) {
    out.push({ type: "del", text: a[i], oldNo: oldNo++ })
    i++
  }
  while (j < n) {
    out.push({ type: "add", text: b[j], newNo: newNo++ })
    j++
  }
  return out
}

/** addedLines builds an all-additions diff (e.g. write_file to a new/overwritten file). */
export function addedLines(text: string): DiffLine[] {
  if (text === "") return []
  return text.split("\n").map((line, i) => ({ type: "add", text: line, newNo: i + 1 }))
}
