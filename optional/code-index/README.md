# Optional code index deps

Install for AST chunking (tree-sitter) and LanceDB vector store:

```bash
cd optional/code-index
npm install
```

Deep CLI core stays zero-deps; these packages are loaded via dynamic import when present.

Without install: regex chunking + JSON index + hash/llama embeddings.
