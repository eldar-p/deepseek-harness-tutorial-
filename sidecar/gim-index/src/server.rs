use crate::index::IndexState;
use rouille::{Request, Response, Server};
use serde_json::{json, Value};
use std::io::Read;
use std::sync::{Arc, Mutex};

pub fn run(port: u16, state: Arc<Mutex<IndexState>>) {
    let addr = format!("127.0.0.1:{}", port);
    Server::new(&addr, move |req| handle(req, Arc::clone(&state))).unwrap();
}

fn handle(req: &Request, state: Arc<Mutex<IndexState>>) -> Response {
    let path = req.url().split('?').next().unwrap_or("");
    match (req.method(), path) {
        ("GET", "/status") => {
            let st = state.lock().unwrap().status();
            json_response(200, st)
        }
        ("POST", "/search") => {
            let body = read_body(req);
            let query = parse_json(&body)
                .get("query")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let limit = parse_json(&body)
                .get("limit")
                .and_then(|v| v.as_u64())
                .unwrap_or(8) as usize;
            let st = state.lock().unwrap();
            json_response(200, st.search(query, limit.max(1)))
        }
        ("POST", "/build") => {
            let st = state.lock().unwrap();
            json_response(501, st.build_hint())
        }
        ("POST", "/touch") => {
            let body = read_body(req);
            let rel = parse_json(&body)
                .get("path")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let st = state.lock().unwrap();
            json_response(200, st.touch(rel))
        }
        _ => json_response(404, json!({ "error": "not found" })),
    }
}

fn read_body(req: &Request) -> String {
    let mut buf = String::new();
    req.data().unwrap_or(&mut std::io::empty()).read_to_string(&mut buf).ok();
    buf
}

fn parse_json(body: &str) -> Value {
    serde_json::from_str(body).unwrap_or(json!({}))
}

fn json_response(status: u16, value: Value) -> Response {
    Response::text(serde_json::to_string(&value).unwrap_or_else(|_| "{}".into()))
        .with_status_code(status)
        .with_header("Content-Type", "application/json".to_string())
}
