use crate::embed::{cosine, hash_embed};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
pub struct StoredChunk {
    pub id: String,
    pub path: String,
    pub symbol: String,
    pub kind: String,
    #[serde(rename = "startLine")]
    pub start_line: u32,
    #[serde(rename = "endLine")]
    pub end_line: u32,
    pub text: String,
    pub lang: String,
    pub vector: Vec<f32>,
    pub mtime: u64,
}

pub struct IndexState {
    workspace: PathBuf,
    index_dir: PathBuf,
    #[allow(dead_code)]
    llama_url: Option<String>,
}

impl IndexState {
    pub fn new(workspace: PathBuf, llama_url: Option<String>) -> Self {
        let index_dir = workspace.join(".gim").join("code-index");
        Self {
            workspace,
            index_dir,
            llama_url,
        }
    }

    pub fn touch(&self, rel: &str) -> Value {
        crate::touch::touch_file(self, rel)
    }

    pub fn index_dir(&self) -> &Path {
        &self.index_dir
    }

    pub fn workspace(&self) -> &Path {
        &self.workspace
    }

    pub fn status(&self) -> Value {
        let meta_path = self.index_dir.join("meta.json");
        if !meta_path.exists() {
            return json!({
                "backend": "json",
                "builtAt": null,
                "chunkCount": 0,
                "fileCount": 0,
                "sidecar": "native"
            });
        }
        let raw = fs::read_to_string(&meta_path).unwrap_or_else(|_| "{}".into());
        let mut meta: Value = serde_json::from_str(&raw).unwrap_or(json!({}));
        if let Some(obj) = meta.as_object_mut() {
            obj.insert("sidecar".into(), json!("native"));
        }
        meta
    }

    pub fn search(&self, query: &str, limit: usize) -> Value {
        let chunks = self.load_all_chunks();
        if chunks.is_empty() {
            return json!({ "ok": true, "hits": [], "backend": "native", "chunkCount": 0 });
        }
        let qvec = hash_embed(query);
        let mut scored: Vec<(f32, &StoredChunk)> = chunks
            .iter()
            .map(|c| (cosine(&qvec, &c.vector), c))
            .filter(|(s, _)| *s > 0.01)
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let hits: Vec<Value> = scored
            .into_iter()
            .take(limit)
            .map(|(score, c)| {
                json!({
                    "score": score,
                    "path": c.path,
                    "symbol": c.symbol,
                    "kind": c.kind,
                    "startLine": c.start_line,
                    "endLine": c.end_line,
                    "text": c.text,
                    "id": c.id
                })
            })
            .collect();
        json!({
            "ok": true,
            "hits": hits,
            "backend": "native",
            "chunkCount": chunks.len()
        })
    }

    pub fn build_hint(&self) -> Value {
        json!({
            "ok": false,
            "error": "native sidecar MVP: use `gim index build` (JS indexer writes shards/chunks.json)",
            "hint": "POST /search works after build"
        })
    }

    pub fn touch_hint(&self, path: &str) -> Value {
        json!({
            "ok": false,
            "path": path,
            "error": "native sidecar MVP: use `gim index build` or JS /touch via gim start",
        })
    }

    fn load_all_chunks(&self) -> Vec<StoredChunk> {
        let meta_path = self.index_dir.join("meta.json");
        let sharded = meta_path
            .exists()
            .then(|| fs::read_to_string(&meta_path).ok())
            .flatten()
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
            .and_then(|v| v.get("sharded").and_then(|b| b.as_bool()))
            .unwrap_or(false);

        if sharded {
            let files_path = self.index_dir.join("files.json");
            if files_path.exists() {
                if let Ok(raw) = fs::read_to_string(&files_path) {
                    if let Ok(map) = serde_json::from_str::<HashMap<String, Value>>(&raw) {
                        let mut out = Vec::new();
                        for rel in map.keys() {
                            out.extend(self.load_file_shard(rel));
                        }
                        if !out.is_empty() {
                            return out;
                        }
                    }
                }
            }
        }

        let chunks_path = self.index_dir.join("chunks.json");
        if !chunks_path.exists() {
            return Vec::new();
        }
        let raw = fs::read_to_string(chunks_path).unwrap_or_else(|_| "{}".into());
        serde_json::from_str::<ChunkFile>(&raw)
            .map(|f| f.chunks)
            .unwrap_or_default()
    }

    fn load_file_shard(&self, rel: &str) -> Vec<StoredChunk> {
        let key = rel.replace('\\', "/").chars().take(220).collect::<String>();
        let fname = format!("{}.json", key.replace('/', "__"));
        let p = self.index_dir.join("shards").join(fname);
        if !p.exists() {
            return Vec::new();
        }
        let raw = fs::read_to_string(p).unwrap_or_default();
        serde_json::from_str::<ShardFile>(&raw)
            .map(|f| f.chunks)
            .unwrap_or_default()
    }
}

#[derive(Deserialize)]
struct ChunkFile {
    chunks: Vec<StoredChunk>,
}

#[derive(Deserialize)]
struct ShardFile {
    chunks: Vec<StoredChunk>,
}
