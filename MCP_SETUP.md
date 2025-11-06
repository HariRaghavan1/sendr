# Supabase MCP Setup Guide

## Overview

The Supabase Model Context Protocol (MCP) server allows Cursor to interact with your Supabase project directly. You can configure it either **globally** (for all projects) or **per-project** (for this specific project).

## Option 1: Global Installation (Recommended)

Install the Supabase MCP server globally using `pipx`:

```bash
# Install pipx if you don't have it
brew install pipx  # macOS
# or
pip install pipx   # Linux/Windows

# Install Supabase MCP server globally
pipx install supabase-mcp-server
```

This makes the MCP server available to all projects on your system.

## Option 2: Project-Specific Installation

Install the MCP server in this project only:

```bash
# Navigate to your project
cd /Users/hariraghavan/Downloads/scratch-forge-art

# Create a virtual environment (if using Python)
python -m venv venv
source venv/bin/activate  # macOS/Linux

# Install Supabase MCP server
pip install supabase-mcp-server
```

## Configuration in Cursor

After installation, you need to configure Cursor to use the MCP server:

### 1. Open Cursor Settings

- **macOS**: `Cmd + ,` or `Cursor > Settings`
- **Windows/Linux**: `Ctrl + ,`

### 2. Navigate to MCP Settings

- Go to **Features** > **Model Context Protocol** (or search for "MCP")
- Or edit Cursor's configuration file directly

### 3. Add Supabase MCP Configuration

Add this to your Cursor MCP configuration (usually in `~/.cursor/mcp.json` or similar):

```json
{
  "mcpServers": {
    "supabase": {
      "command": "supabase-mcp-server",
      "env": {
        "SUPABASE_PROJECT_REF": "hstziwxrodpuuzjtvold",
        "SUPABASE_DB_PASSWORD": "your-database-password",
        "SUPABASE_ACCESS_TOKEN": "sbp_6f98d6f2978304832dfa099832279df5cf1a00dc"
      }
    }
  }
}
```

### 4. Alternative: Per-Project Configuration

Create a `.cursor/mcp.json` file in your project root:

```bash
mkdir -p .cursor
cat > .cursor/mcp.json << 'EOF'
{
  "mcpServers": {
    "supabase": {
      "command": "supabase-mcp-server",
      "env": {
        "SUPABASE_PROJECT_REF": "hstziwxrodpuuzjtvold",
        "SUPABASE_DB_PASSWORD": "your-database-password",
        "SUPABASE_ACCESS_TOKEN": "sbp_6f98d6f2978304832dfa099832279df5cf1a00dc"
      }
    }
  }
}
EOF
```

## Getting Your Database Password

If you don't have your database password:

1. Go to: https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/settings/database
2. Click "Reset database password" or "Show connection string"
3. Copy the password from the connection string

## Verification

After configuration:

1. Restart Cursor
2. The MCP server should automatically connect
3. You can verify by asking Cursor to list your Supabase tables

## Using the Supabase MCP

Once configured, you can use commands like:

- "List all tables in my Supabase project"
- "Run a migration on my Supabase database"
- "Get the project URL"
- "Check my Supabase secrets"

## Troubleshooting

### MCP Server Not Found

If you get "command not found" errors:

```bash
# For global installation, ensure pipx bin is in PATH
pipx ensurepath

# For project installation, use full path
which supabase-mcp-server
```

### Connection Issues

- Verify your `SUPABASE_ACCESS_TOKEN` is valid
- Check that `SUPABASE_PROJECT_REF` matches your project ID
- Ensure your database password is correct

### Alternative: Use Supabase CLI

If MCP setup is complex, you can use the Supabase CLI directly:

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref hstziwxrodpuuzjtvold

# Now you can use CLI commands
supabase db push
supabase secrets set OPENAI_API_KEY=sk-...
```

## Resources

- [Supabase MCP Server GitHub](https://github.com/Deploya-labs/mcp-supabase)
- [Cursor MCP Documentation](https://docs.cursor.com)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)


