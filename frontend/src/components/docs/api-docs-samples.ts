/** Builds runnable API samples against the current origin. */
export function buildRunSamples(base: string) {
  return [
    {
      id: "curl",
      label: "cURL",
      code: `curl -N -X POST "${base}/v1/agents/run" \\
  -H "Authorization: Bearer <JWT>" \\
  -H "Content-Type: application/json" \\
  -H "Accept: text/event-stream" \\
  -d '{
    "agent": "agt_demo01",
    "prompt": "你好，介绍一下你自己"
  }'`,
    },
    {
      id: "js",
      label: "JavaScript",
      code: `const res = await fetch("${base}/v1/agents/run", {
  method: "POST",
  headers: {
    Authorization: "Bearer <JWT>",
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  },
  body: JSON.stringify({
    agent: "agt_demo01",
    prompt: "你好，介绍一下你自己",
  }),
})

const reader = res.body.getReader()
const decoder = new TextDecoder()
let buf = ""
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  buf += decoder.decode(value, { stream: true })
  const parts = buf.split("\\n\\n")
  buf = parts.pop() || ""
  for (const chunk of parts) {
    const line = chunk.split("\\n").find((l) => l.startsWith("data: "))
    if (!line) continue
    const event = JSON.parse(line.slice(6))
    console.log(event.type, event)
  }
}`,
    },
    {
      id: "python",
      label: "Python",
      code: `import json, requests

url = "${base}/v1/agents/run"
headers = {
    "Authorization": "Bearer <JWT>",
    "Content-Type": "application/json",
    "Accept": "text/event-stream",
}
payload = {"agent": "agt_demo01", "prompt": "你好，介绍一下你自己"}

with requests.post(url, headers=headers, json=payload, stream=True) as r:
    r.raise_for_status()
    for line in r.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue
        event = json.loads(line[6:])
        print(event["type"], event)`,
    },
  ]
}

/** Builds auth token exchange samples. */
export function buildTokenSamples(base: string, loginLabel: string, exchangeLabel: string) {
  return [
    {
      id: "login",
      label: loginLabel,
      code: `curl -X POST "${base}/v1/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"alice","password":"secret1"}'

# → { "token": "<JWT>", "user_id": "usr_...", "user": {...} }`,
    },
    {
      id: "exchange",
      label: exchangeLabel,
      code: `curl -X POST "${base}/v1/auth/token" \\
  -H "Content-Type: application/json" \\
  -d '{"api_key":"ca_your_raw_key"}'

# → { "token": "<JWT>", "user_id": "...", "key_id": "..." }`,
    },
  ]
}
