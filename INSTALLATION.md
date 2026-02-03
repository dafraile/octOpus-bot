# Installation Guide (OpenClaw Fork)

This fork routes Anthropic models through **Claude Code CLI** and supports the `.shrimp/` context layout. Use this guide for local installs and dev runs.

## Prerequisites

- Node.js **22+**
- `pnpm` (recommended)
- Git
- Claude Code CLI on your `PATH`

## Install Claude Code CLI

Use the official installer (recommended), or a package manager:

```bash
curl -fsSL https://claude.ai/install.sh | bash
# or on macOS/Linux:
brew install --cask claude-code
```

Windows (PowerShell):

```powershell
irm https://claude.ai/install.ps1 | iex
```

## Install from source

```bash
git clone https://github.com/dafraile/octOpus-bot.git
cd openclaw

pnpm install
pnpm ui:build
pnpm build
```

Dev loop (auto-reload):

```bash
pnpm gateway:watch
```

## Configure Anthropic to use Claude Code CLI

OpenClaw reads config from `~/.openclaw/openclaw.json`. Minimal config:

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic/claude-opus-4-5"
    }
  }
}
```

If `claude` is not on `PATH`, pin the CLI command:

```json
{
  "agents": {
    "defaults": {
      "cliBackends": {
        "anthropic": {
          "command": "/absolute/path/to/claude"
        }
      }
    }
  }
}
```

Note: the default Anthropic CLI args include `--dangerously-skip-permissions`. Override
`agents.defaults.cliBackends.anthropic.args` if you need stricter prompts.

## Optional: .shrimp context files

Create a `.shrimp/` folder in your workspace to inject structured memory:

```
.shrimp/
  US.md
  PRINCIPLES.md
  CONTEXT.md
  memory/
    2026-02-03.md
```

Up to 7 recent `.shrimp/memory/*.md` files are loaded automatically and combined into a single context block.

## Verify

```bash
claude --version
pnpm openclaw agent --message "ping"
```

Troubleshooting:
- If you see `Unknown CLI backend` or `claude` not found, fix `PATH` or set the absolute command as above.
- For CLI output debugging: `OPENCLAW_CLAUDE_CLI_LOG_OUTPUT=1`.
