//! Hash embed — matches `src/code-index/embedder.js` (EMBED_DIM=256, FNV-style hash).

pub const EMBED_DIM: usize = 256;

pub fn hash_embed(text: &str) -> Vec<f32> {
    let mut vec = vec![0f32; EMBED_DIM];
    let tokens: Vec<&str> = text
        .to_lowercase()
        .replace(|c: char| !c.is_alphanumeric() && c != '$' && !c.is_whitespace(), " ")
        .split_whitespace()
        .collect();
    for tok in tokens {
        let mut h: u32 = 2166136261;
        for b in tok.bytes() {
            h ^= u32::from(b);
            h = h.wrapping_mul(16777619);
        }
        let idx = (h as usize) % EMBED_DIM;
        vec[idx] += 1.0;
    }
    normalize(&mut vec);
    vec
}

fn normalize(vec: &mut [f32]) {
    let mut sum = 0f32;
    for v in vec.iter() {
        sum += v * v;
    }
    if sum <= 0.0 {
        return;
    }
    let inv = sum.sqrt().recip();
    for v in vec.iter_mut() {
        *v *= inv;
    }
}

pub fn cosine(a: &[f32], b: &[f32]) -> f32 {
    let mut dot = 0f32;
    let mut na = 0f32;
    let mut nb = 0f32;
    for i in 0..a.len().min(b.len()) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        return 0.0;
    }
    dot / (na.sqrt() * nb.sqrt())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_embed() {
        let a = hash_embed("hello world auth");
        let b = hash_embed("hello world auth");
        assert_eq!(a, b);
        assert!(cosine(&a, &b) > 0.99);
    }
}
