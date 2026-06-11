import type {
  AgentEvent,
  ConversationEntry,
  ScenarioInfo,
  ToolCallEntry,
  ToolInfo,
} from "@/types/agent"

// ─── Mock Scenarios ───────────────────────────────────────────────

export const MOCK_SCENARIOS: ScenarioInfo[] = [
  {
    name: "general-chat",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    tools: ["echo", "get_time"],
    maxTurns: 10,
    systemPrompt: "You are a helpful assistant.",
  },
  {
    name: "code-review",
    provider: "openai",
    model: "gpt-4o",
    tools: ["echo", "get_time"],
    maxTurns: 20,
    systemPrompt: "You are a code review assistant. Analyze code for bugs, style issues, and improvements.",
  },
  {
    name: "data-analysis",
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    tools: ["echo", "get_time"],
    maxTurns: 15,
    systemPrompt: "You are a data analysis assistant. Help users analyze and visualize data.",
  },
]

// ─── Mock Tools ───────────────────────────────────────────────────

export const MOCK_TOOLS: ToolInfo[] = [
  {
    name: "echo",
    description: "Echo back the provided message. Useful for testing.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "Message to echo back" },
      },
      required: ["message"],
    },
  },
  {
    name: "get_time",
    description: "Return the current UTC time in RFC3339 format.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
]

// ─── Mock Conversation ────────────────────────────────────────────

let _idCounter = 0
function nextId(): string {
  return `msg-${++_idCounter}`
}

function makeToolCall(
  name: string,
  input: unknown,
  output: unknown,
  status: ToolCallEntry["status"] = "completed"
): ToolCallEntry {
  return {
    id: nextId(),
    name,
    input,
    output,
    status,
    startTime: Date.now() - 3000,
    endTime: Date.now(),
  }
}

export function createMockConversation(): ConversationEntry[] {
  const now = Date.now()

  return [
    {
      id: nextId(),
      role: "user",
      content: "现在几点了？另外帮我 echo 一下 hello world",
      timestamp: now - 60000,
    },
    {
      id: nextId(),
      role: "assistant",
      content: "",
      reasoningContent:
        "用户问了两个问题：1) 当前时间，2) echo 一个消息。我需要调用 get_time 工具获取当前时间，然后调用 echo 工具返回 hello world。让我依次调用这两个工具。",
      toolCalls: [
        makeToolCall("get_time", {}, "2026-06-09T14:32:15Z"),
        makeToolCall("echo", { message: "hello world" }, "hello world"),
      ],
      timestamp: now - 55000,
    },
    {
      id: nextId(),
      role: "assistant",
      content:
        "当前时间是 **2026-06-09T14:32:15Z**（UTC）。\n\nEcho 的结果是：`hello world`\n\n还有什么我可以帮你的吗？",
      timestamp: now - 54000,
    },
    {
      id: nextId(),
      role: "user",
      content: "帮我写一个 TypeScript 的快速排序实现",
      timestamp: now - 30000,
    },
    {
      id: nextId(),
      role: "assistant",
      content: "",
      reasoningContent:
        "用户要求一个 TypeScript 快速排序实现。我来写一个标准的快速排序，包含类型注解和注释。使用 Lomuto partition scheme，选择最后一个元素作为 pivot。",
      timestamp: now - 28000,
    },
    {
      id: nextId(),
      role: "assistant",
      content:
        '这是一个 TypeScript 实现的快速排序：\n\n```typescript\nfunction quickSort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {\n  if (arr.length <= 1) return arr\n\n  const result = [...arr]\n  _quickSort(result, 0, result.length - 1, compare)\n  return result\n}\n\nfunction _quickSort<T>(\n  arr: T[],\n  low: number,\n  high: number,\n  compare: (a: T, b: T) => number\n): void {\n  if (low < high) {\n    const pivotIndex = partition(arr, low, high, compare)\n    _quickSort(arr, low, pivotIndex - 1, compare)\n    _quickSort(arr, pivotIndex + 1, high, compare)\n  }\n}\n\nfunction partition<T>(\n  arr: T[],\n  low: number,\n  high: number,\n  compare: (a: T, b: T) => number\n): number {\n  const pivot = arr[high]\n  let i = low - 1\n\n  for (let j = low; j < high; j++) {\n    if (compare(arr[j], pivot) <= 0) {\n      i++\n      ;[arr[i], arr[j]] = [arr[j], arr[i]]\n    }\n  }\n\n  ;[arr[i + 1], arr[high]] = [arr[high], arr[i + 1]]\n  return i + 1\n}\n\n// 使用示例\nconst numbers = [38, 27, 43, 3, 9, 82, 10]\nconst sorted = quickSort(numbers, (a, b) => a - b)\nconsole.log(sorted) // [3, 9, 10, 27, 38, 43, 82]\n```\n\n**特点：**\n- 泛型支持，可用于任意类型\n- 自定义比较函数\n- 原地排序，不额外分配数组空间\n- 平均时间复杂度 O(n log n)',
      timestamp: now - 25000,
    },
  ]
}

// ─── Mock Event Stream Generator ──────────────────────────────────

const MOCK_RESPONSES: Record<string, { reasoning: string; text: string; tools?: Array<{ name: string; input: unknown; output: unknown }> }> = {
  default: {
    reasoning: "用户发送了一条消息，我需要理解并回复。",
    text: "收到你的消息了！有什么我可以帮你的吗？",
  },
  time: {
    reasoning: "用户想知道当前时间，我需要调用 get_time 工具。",
    text: "让我帮你查看一下当前时间。",
    tools: [{ name: "get_time", input: {}, output: "2026-06-09T15:45:30Z" }],
  },
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function* generateMockEventStream(
  _scenario: string,
  prompt: string
): AsyncGenerator<AgentEvent> {
  const lower = prompt.toLowerCase()
  const response =
    lower.includes("时间") || lower.includes("time")
      ? MOCK_RESPONSES.time
      : MOCK_RESPONSES.default

  // Phase 1: Reasoning
  for (const char of response.reasoning) {
    yield { type: "reasoning_delta", content: char }
    await delay(15)
  }

  // Phase 2: Tool calls (if any)
  if (response.tools) {
    for (const tool of response.tools) {
      yield { type: "tool_start", tool: tool.name, input: tool.input }
      await delay(800)
      yield { type: "tool_result", tool: tool.name, output: tool.output }
      await delay(200)
    }
  }

  // Phase 3: Text response
  for (const char of response.text) {
    yield { type: "text_delta", content: char }
    await delay(30)
  }

  // Phase 4: Done
  yield { type: "done", status: "completed", turns: 1 }
}

// ─── Mock Streaming Text (for demo without async generator) ───────

export const MOCK_STREAMING_TEXT =
  "这是一个模拟的流式文本输出效果。你可以看到文字逐字出现，就像 LLM 真正在生成回复一样。这种交互方式让用户体验更加自然流畅。"

export const MOCK_REASONING_TEXT =
  "让我分析一下用户的问题。用户想要测试流式输出效果，所以我需要生成一段足够长的文本来展示逐字渲染的过程。同时我应该包含一些中文和标点符号来测试不同的字符处理。"
