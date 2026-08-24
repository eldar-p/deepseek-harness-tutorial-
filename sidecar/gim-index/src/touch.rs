use crate::embed::hash_embed;
use serde_json::{json, Value};
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;

use super::index::{IndexState, StoredChunk};

pub fn touch_file(state: &IndexState, rel: &str) -> Value {
    let norm = rel.replace('\\', "/");
    let abs = state.workspace().join(&norm);
    if !abs.exists() {
        return json!({ "ok": false, "error": "file not found", "path": norm });
    }
    let text = match fs::read_to_string(&abs) {
        Ok(t) => t,
        Err(e) => return json!({ "ok": false, "error": e.to_string(), "path": norm }),
    };
    let hash = content_hash(&text);
    let chunks = chunk_source(&norm, &text);
    let shard_path = shard_path_for(state.index_dir(), &norm);
    if let Some(parent) = shard_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let shard = json!({ "path": norm, "chunks": chunks });
    if let Err(e) = fs::write(&shard_path, serde_json::to_string(&shard).unwrap_or_default()) {
        return json!({ "ok": false, "error": e.to_string(), "path": norm });
    }
    let _ = update_files_json(state.index_dir(), &norm, &hash);
    let _ = bump_meta(state.index_dir(), chunks.len());
    json!({
        "ok": true,
        "path": norm,
        "chunks": chunks.len(),
        "sharded": true,
        "backend": "native"
    })
}

fn content_hash(text: &str) -> String {
    let mut h = DefaultHasher::new();
    text.hash(&mut h);
    format!("{:016x}", h.finish())
}

fn chunk_source(rel: &str, text: &str) -> Vec<StoredChunk> {
    let mut out = Vec::new();
    let lang = if rel.ends_with(".py") {
        "py"
    } else if rel.ends_with(".rs") {
        "rs"
    } else {
        "js"
    };
    for (i, line) in text.lines().enumerate() {
        let trimmed = line.trim();
        let is_sym = trimmed.starts_with("export function ")
            || trimmed.starts_with("function ")
            || trimmed.starts_with("export async function ")
            || trimmed.starts_with("async function ")
            || trimmed.starts_with("export class ")
            || trimmed.starts_with("class ")
            || trimmed.starts_with("def ");
        if !is_sym {
            continue;
        }
        let symbol = extract_symbol(trimmed);
        let body = format!("{} {} {}", rel, symbol, trimmed);
        let vector = hash_embed(&body);
        out.push(StoredChunk {
            id: format!("{}:{}:{}", rel, i + 1, symbol),
            path: rel.to_string(),
            symbol,
            kind: if trimmed.contains("class ") {
                "class".into()
            } else {
                "function".into()
            },
            start_line: (i + 1) as u32,
            end_line: (i + 1) as u32,
            text: trimmed.to_string(),
            lang: lang.into(),
            vector,
            mtime: 0,
        });
    }
    if out.is_empty() && !text.is_empty() {
        let vector = hash_embed(&format!("{} file", rel));
        out.push(StoredChunk {
            id: format!("{}:1:file", rel),
            path: rel.to_string(),
            symbol: "file".into(),
            kind: "file".into(),
            start_line: 1,
            end_line: text.lines().count().max(1) as u32,
            text: text.chars().take(400).collect(),
            lang: lang.into(),
            vector,
            mtime: 0,
        });
    }
    out
}

fn extract_symbol(line: &str) -> String {
    let parts: Vec<&str> = line.split_whitespace().collect();
    for (i, p) in parts.iter().enumerate() {
        if *p == "function" || *p == "class" {
            if let Some(name) = parts.get(i + 1) {
                return name.trim_end_matches('(').trim_end_matches('{').to_string();
            }
        }
        if *p == "def" {
            if let Some(name) = parts.get(i + 1) {
                return name.trim_end_matches('(').to_string();
            }
        }
    }
    "anon".into()
}

fn shard_path_for(index_dir: &Path, rel: &str) -> std::path::PathBuf {
    let key = rel.replace('/', "__");
    index_dir.join("shards").join(format!("{}.json", key))
}

fn update_files_json(index_dir: &Path, rel: &str, hash: &str) -> std::io::Result<()> {
    let p = index_dir.join("files.json");
    let mut map: serde_json::Map<String, Value> = if p.exists() {
        serde_json::from_str(&fs::read_to_string(&p)?).unwrap_or_default()
    } else {
        serde_json::Map::new()
    };
    map.insert(
        rel.to_string(),
        json!({ "hash": hash, "mtime": chrono_now() }),
    );
    fs::write(p, serde_json::to_string(&map).unwrap_or_default())
}

fn bump_meta(index_dir: &Path, chunk_count: usize) -> std::io::Result<()> {
    let p = index_dir.join("meta.json");
    let mut meta: Value = if p.exists() {
        serde_json::from_str(&fs::read_to_string(&p)?).unwrap_or(json!({}))
    } else {
        json!({})
    };
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("chunkCount".into(), json!(chunk_count));
        obj.insert("sharded".into(), json!(true));
        obj.insert("backend".into(), json!("json"));
        obj.insert("builtAt".into(), json!(chrono_now_iso()));
        obj.insert("sidecar".into(), json!("native"));
    }
    fs::write(p, serde_json::to_string_pretty(&meta).unwrap_or_default())
}

fn chrono_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn chrono_now_iso() -> String {
    format!("{}", chrono_now())
}
