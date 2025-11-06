#!/bin/bash

# Supabase MCP Setup Script
# This script helps you install and configure the Supabase MCP server

set -e

echo "🚀 Supabase MCP Setup"
echo "======================"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not found. Please install Python 3 first."
    exit 1
fi

echo "✅ Python 3 found: $(python3 --version)"
echo ""

# Ask user preference
echo "Choose installation method:"
echo "1) Global installation (recommended) - uses pipx"
echo "2) Project-specific installation - uses pip in venv"
read -p "Enter choice (1 or 2): " choice

if [ "$choice" = "1" ]; then
    # Global installation with pipx
    echo ""
    echo "📦 Installing pipx for global installation..."
    
    if ! command -v pipx &> /dev/null; then
        if command -v brew &> /dev/null; then
            echo "Installing pipx via Homebrew..."
            brew install pipx
        else
            echo "Installing pipx via pip..."
            pip3 install --user pipx
            pipx ensurepath
        fi
    fi
    
    echo "✅ pipx installed"
    echo ""
    echo "📦 Installing Supabase MCP server globally..."
    pipx install supabase-mcp-server
    
    echo ""
    echo "✅ Supabase MCP server installed globally!"
    echo "   Command: supabase-mcp-server"
    
elif [ "$choice" = "2" ]; then
    # Project-specific installation
    echo ""
    echo "📦 Setting up project-specific installation..."
    
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    echo "Activating virtual environment..."
    source venv/bin/activate
    
    echo "Installing Supabase MCP server..."
    pip install supabase-mcp-server
    
    echo ""
    echo "✅ Supabase MCP server installed in project!"
    echo "   Location: ./venv/bin/supabase-mcp-server"
    
else
    echo "❌ Invalid choice. Exiting."
    exit 1
fi

echo ""
echo "📝 Next Steps:"
echo "=============="
echo ""
echo "1. Configure Cursor to use the MCP server:"
echo "   - Open Cursor Settings (Cmd+,)"
echo "   - Go to Features > Model Context Protocol"
echo "   - Add Supabase MCP configuration"
echo ""
echo "2. Or create .cursor/mcp.json in this project:"
echo ""
echo "   mkdir -p .cursor"
echo "   cat > .cursor/mcp.json << 'EOF'"
echo "   {"
echo "     \"mcpServers\": {"
echo "       \"supabase\": {"
echo "         \"command\": \"supabase-mcp-server\","
echo "         \"env\": {"
echo "           \"SUPABASE_PROJECT_REF\": \"hstziwxrodpuuzjtvold\","
echo "           \"SUPABASE_ACCESS_TOKEN\": \"sbp_6f98d6f2978304832dfa099832279df5cf1a00dc\""
echo "         }"
echo "       }"
echo "     }"
echo "   }"
echo "   EOF"
echo ""
echo "3. Restart Cursor after configuration"
echo ""
echo "📚 See MCP_SETUP.md for detailed instructions"
echo ""


