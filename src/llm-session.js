/**
 * Colibri KV cache_slot allocation — one slot per chat, universal (no model names).
 * Maps to Colibri `cache_slot` field (0 .. COLI_KV_SLOTS-1).
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { paths, chmodOwnerOnly } from './paths.js'
import { readJsonFile, writeJsonFile } from './json-io.js'

export const DEFAULT_KV_SLOTS = Number(process.env.COLI_KV_SLOTS || process.env.GIM_KV_SLOTS || 8)

function slotsPath() {
  return path.join(paths().home, 'cache', 'llm', 'kv-slots.json')
}

function loadRegistry() {
  const f = slotsPath()
  if (!fs.existsSync(f)) return { version: 1, slots: {}, next: 1 }
  try {
    return readJsonFile(f)
  } catch {
    return { version: 1, slots: {}, next: 1 }
  }
}

function saveRegistry(reg) {
  const f = slotsPath()
  fs.mkdirSync(path.dirname(f), { recursive: true })
  writeJsonFile(f, reg)
  chmodOwnerOnly(f)
}

function sessionKey(stack, chatId) {
  return `${stack}:${chatId}`
}

/**
 * Stable slot for a chat thread (1..max-1). Slot 0 = ephemeral / no chatId.
 * @param {string} stack
 * @param {string|null|undefined} chatId
 * @param {number} [maxSlots]
 */
export function resolveCacheSlot(stack, chatId, maxSlots = DEFAULT_KV_SLOTS) {
  const max = Math.min(Math.max(2, maxSlots), 16)
  if (!chatId) return 0

  const reg = loadRegistry()
  const key = sessionKey(stack, chatId)
  if (reg.slots[key] != null) {
    const slot = Number(reg.slots[key])
    if (slot >= 0 && slot < max) return slot
  }

  let slot = reg.next || 1
  if (slot >= max) slot = 1
  reg.slots[key] = slot
  reg.next = slot + 1 >= max ? 1 : slot + 1
  saveRegistry(reg)
  return slot
}

/** @param {string} stack @param {string} chatId */
export function releaseCacheSlot(stack, chatId) {
  if (!chatId) return
  const reg = loadRegistry()
  const key = sessionKey(stack, chatId)
  if (reg.slots[key] == null) return
  delete reg.slots[key]
  saveRegistry(reg)
}

/** Hash for anonymous sessions (eval scripts). */
export function cacheSlotFromSeed(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest()
  const max = DEFAULT_KV_SLOTS
  return 1 + (h[0] % Math.max(1, max - 1))
}

export function listCacheSlotAssignments() {
  const reg = loadRegistry()
  return { ...reg.slots }
}
