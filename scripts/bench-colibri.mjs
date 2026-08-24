/** Quick Colibri speed + accuracy check */
const API = process.env.COLIBRI_URL || 'http://127.0.0.1:8092/v1'
const KEY = process.env.GIM_COLIBRI_API_KEY || 'sk-gim-colibri'
const hdr = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function chat(prompt, extra = {}) {
  const t0 = Date.now()
  const res = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: hdr,
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 64,
      stream: false,
      ...extra,
    }),
    signal: AbortSignal.timeout(180_000),
  })
  const ms = Date.now() - t0
  const text = await res.text()
  let content = ''
  let error = null
  try {
    const j = JSON.parse(text)
    content = j.choices?.[0]?.message?.content || ''
    error = j.error?.message || null
    if (j.choices?.[0]?.message?.tool_calls) {
      const tc = j.choices[0].message.tool_calls[0]
      content = `[tool] ${tc.function?.name} ${tc.function?.arguments || ''}`
    }
  } catch {
    content = text.slice(0, 200)
  }
  return { status: res.status, ms, content: String(content).trim(), error }
}

console.log('=== Colibri benchmark ===', API)

const tests = [
  { name: 'ping', prompt: 'Reply with exactly: pong', expect: /pong/i },
  { name: 'math', prompt: 'What is 17*24? Reply with only the number.', expect: /408/ },
  { name: 'code', prompt: 'One line Python that prints sum(range(5)). No explanation.', expect: /10|print/ },
  { name: 'fact', prompt: 'Capital of France? One word only.', expect: /paris/i },
]

const results = []
for (const t of tests) {
  const r = await chat(t.prompt)
  const ok = t.expect.test(r.content)
  results.push({ ...t, ...r, ok })
  console.log(`${t.name}: HTTP ${r.status} ${r.ms}ms ${ok ? 'OK' : 'MISS'} | ${r.content.slice(0, 80)}${r.error ? ' ERR:' + r.error : ''}`)
  await new Promise((x) => setTimeout(x, 3000))
}

const tool = await chat('List the workspace root directory.', {
  tools: [
    {
      type: 'function',
      function: {
        name: 'list_dir',
        description: 'List directory',
        parameters: { type: 'object', properties: { path: { type: 'string' } } },
      },
    },
  ],
  tool_choice: 'auto',
  max_tokens: 128,
})
const toolOk = /list_dir/.test(tool.content)
console.log(`tool_call: HTTP ${tool.status} ${tool.ms}ms ${toolOk ? 'OK' : 'MISS'} | ${tool.content.slice(0, 100)}`)

const passed = results.filter((r) => r.ok).length
const avgMs = Math.round(results.reduce((a, r) => a + r.ms, 0) / results.length)
console.log('\n=== SUMMARY ===')
console.log(`accuracy: ${passed}/${results.length} text tests`)
console.log(`tool_call: ${toolOk ? 'yes' : 'no'}`)
console.log(`avg latency: ${avgMs}ms (text-only, no tools in prompt)`)
console.log(`note: context window appears 4096 — tools eat ~900 tokens`)
