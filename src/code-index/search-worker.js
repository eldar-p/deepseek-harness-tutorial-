import { parentPort, workerData } from 'node:worker_threads'

/**
 * Batch cosine similarity: query vector vs flat row-major matrix.
 * Runs off the main thread to avoid blocking the CLI / HTTP proxy.
 * @param {Float32Array} queryVec
 * @param {Float32Array} matrix
 * @param {number} count
 * @param {number} dim
 * @param {number} limit
 * @param {number} minScore
 */
function rankByCosine(queryVec, matrix, count, dim, limit, minScore) {
  /** @type {{ i: number, score: number }[]} */
  const scored = new Array(count)
  for (let row = 0; row < count; row++) {
    const off = row * dim
    let dot = 0
    let nb = 0
    for (let j = 0; j < dim; j++) {
      const v = matrix[off + j]
      dot += queryVec[j] * v
      nb += v * v
    }
    let na = 0
    for (let j = 0; j < dim; j++) na += queryVec[j] * queryVec[j]
    const score = na === 0 || nb === 0 ? 0 : dot / (Math.sqrt(na) * Math.sqrt(nb))
    scored[row] = { i: row, score }
  }
  scored.sort((a, b) => b.score - a.score)
  /** @type {{ i: number, score: number }[]} */
  const out = []
  for (let k = 0; k < scored.length && out.length < limit; k++) {
    if (scored[k].score > minScore) out.push(scored[k])
  }
  return out
}

const { queryVec, matrix, count, dim, limit, minScore } = workerData
parentPort.postMessage(rankByCosine(queryVec, matrix, count, dim, limit, minScore))
