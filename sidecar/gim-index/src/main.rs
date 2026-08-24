//! GIM code index sidecar — native HTTP search over on-disk JSON/shard layout.
//! Build: `cargo build --release` (from this directory).
//! Contract matches `src/code-index/server.js`.

mod embed;
mod index;
mod server;
mod touch;

use clap::Parser;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

#[derive(Parser, Debug)]
#[command(name = "gim-index", about = "GIM code index sidecar")]
struct Args {
    #[arg(long, default_value = "14150")]
    port: u16,
    #[arg(long)]
    workspace: PathBuf,
    #[arg(long)]
    llama_url: Option<String>,
}

fn main() {
    let args = Args::parse();
    let workspace = args.workspace.canonicalize().unwrap_or(args.workspace.clone());
    let state = Arc::new(Mutex::new(index::IndexState::new(workspace.clone(), args.llama_url)));
    eprintln!(
        "[gim-index] backend=native workspace={} port={}",
        workspace.display(),
        args.port
    );
    server::run(args.port, state);
}
