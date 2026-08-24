/** Split assistant text into thoughts + visible (think / thinking tags). */
export function splitThoughts(text) {
  const raw = String(text || '')
  const thoughts = []
  let visible = raw

  const re = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi
  visible = visible.replace(re, (_, inner) => {
    thoughts.push(inner.trim())
    return ''
  })

  const open = visible.match(/<think(?:ing)?>([\s\S]*)$/i)
  if (open) {
    thoughts.push(open[1].trim())
    visible = visible.slice(0, open.index)
  }

  return { thoughts: thoughts.filter(Boolean).join('\n\n'), visible: visible.trim() }
}
