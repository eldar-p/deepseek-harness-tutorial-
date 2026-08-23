# Full agent capability map (VM whoami)

## Access
- sudo NOPASSWD as kodachi
- FHS R/W via sudo: /etc /var /usr /opt /proc /sys
- Network tools: ip, iptables, tcpdump, nmap, ss
- Outbound: Tor SOCKS 9050 only (host clearnet forbidden)

## MCP
- agent-kit: apt/git/libs/surfraw/gh/forums
- agent-ops: sudo_run, journal_tail, net_snapshot, process_snapshot, lint_path, agent_ops
- tor-net, vbox-whoami, team-lms

## Installed OK
bash python3 perl ruby node npm gcc make cmake tmux zsh rg fzf jq curl wget
bandit pylint eslint sqlmap redis-cli psql sqlite3 wg openssl tcpdump nmap strace git stunnel4 ss-local

## Ops home
/mnt/hostshare/agent — checkpoints, queue, logs, knowledge, reports
agent-ops.sh checkpoint|queue-add|status|cleanup|report|notify

## Heavy (needs disk expand)
Docker/Podman/K8s/SonarQube/V2Ray full — see knowledge/heavy-stacks.md

## Cognition
plan → decompose → verify → checkpoint; no unauthorized scanning; no CAPTCHA farms

## Agent Mind
MCP `agent-mind` — tagged journal, episodic/semantic/error memory, priority queue, locks,
change_track/rollback, cost model, drift, dedup, CoT prompts, daily_review, smoke_selftest.
Enrich via Tor: wiki, arxiv, CVE/NVD, whois, shodan(key).
Evolve: `mcp_stub_create` writes new MCP stubs under agent/mind/mcp_generated.
Loop: plan→act→observe→evaluate→remember (+reflect). Skill: agent-mind.
