#!/bin/bash

# RT-SysAgent Setup Script
# This script automates the initial setup of the RT-SysAgent project

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}RT-SysAgent Setup Script${NC}"
echo "================================"
echo

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if we're in the project directory
if [ ! -f "makefile" ]; then
    print_error "This script must be run from the RT-SysAgent project directory"
    exit 1
fi

# Step 1: Install dependencies
print_status "Installing system dependencies..."
sudo apt-get update
sudo apt-get install -y build-essential curl wget git pkg-config
sudo apt-get install -y libudev-dev libsystemd-dev libssl-dev
sudo apt-get install -y linux-headers-generic

# Step 2: Build the project
print_status "Building the project..."
make clean-all
make all

# Step 3: Generate configuration
print_status "Generating configuration..."
if [ -f "./bin/config_generator" ]; then
    ./bin/config_generator
else
    print_warning "Config generator not found, creating basic configuration..."
    mkdir -p config
    mkdir -p keys
    mkdir -p tmp
    mkdir -p logs
fi

# Step 4: Generate RSA keys if they don't exist
if [ ! -f "keys/private_key.pem" ]; then
    print_status "Generating RSA key pair..."
    mkdir -p keys
    openssl genrsa -out keys/private_key.pem 2048
    openssl rsa -in keys/private_key.pem -pubout -out keys/public_key.pem
    chmod 600 keys/private_key.pem
    chmod 644 keys/public_key.pem
else
    print_status "RSA keys already exist"
fi

# Step 5: Check IPFS installation
print_status "Checking IPFS installation..."
if ! command -v ipfs &> /dev/null; then
    print_warning "IPFS not found. Installing IPFS..."
    
    # Download and install IPFS
    IPFS_VERSION="v0.22.0"
    IPFS_URL="https://dist.ipfs.tech/kubo/${IPFS_VERSION}/kubo_${IPFS_VERSION}_linux-amd64.tar.gz"
    
    cd deps
    wget -q "$IPFS_URL" -O ipfs.tar.gz
    tar -xzf ipfs.tar.gz
    sudo cp kubo/ipfs /usr/local/bin/
    rm -rf kubo ipfs.tar.gz
    cd ..
    rm -rf deps
    
    print_status "IPFS installed successfully"
else
    print_status "IPFS already installed"
fi

# Step 6: Initialize IPFS if not already done
if [ ! -d "$HOME/.ipfs" ]; then
    print_status "Initializing IPFS repository..."
    ipfs init
else
    print_status "IPFS repository already initialized"
fi

# Step 7: Generate IPFS key if it doesn't exist
print_status "Checking IPFS key..."
if ! ipfs key list | grep -q "log-agent"; then
    print_status "Generating IPFS key for log storage..."
    ipfs key gen log-agent --type=rsa --size=2048
else
    print_status "IPFS key already exists"
fi

# Step 8: Create default pattern file
print_status "Creating default pattern file..."
mkdir -p tmp
cat > tmp/pattern.txt << 'EOF'
# Security Event Patterns
ERROR
WARNING
CRITICAL
authentication failed
permission denied
unauthorized access
failed login
buffer overflow
segfault
malware
virus
trojan
backdoor
rootkit
connection refused
access denied
root access
port scan
malware detected
invalid user
EOF

# Step 9: Set up systemd service (optional)
read -p "Do you want to set up systemd service for automatic startup? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Setting up systemd service..."
    
    # Create systemd service file
    sudo tee /etc/systemd/system/rt-sysagent.service > /dev/null << EOF
[Unit]
Description=Real-Time System Monitoring Agent
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/bin/agent
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable rt-sysagent.service
    
    print_status "Systemd service configured. Use 'sudo systemctl start rt-sysagent' to start"
fi

# Step 10: Final instructions
echo
echo -e "${GREEN}Setup completed successfully!${NC}"
echo
echo "Next steps:"
echo "1. Start IPFS daemon: ipfs daemon --routing=dhtclient"
echo "2. In another terminal, start the agent: ./bin/agent"
echo "3. In another terminal, start the reader: ./bin/reader"
echo
echo "Configuration files:"
echo "- Main config: config/settings.json"
echo "- Patterns: tmp/pattern.txt"
echo "- RSA keys: keys/private_key.pem, keys/public_key.pem"
echo
echo "Useful commands:"
echo "- View logs: tail -f logs/rt-sysagent.log"
echo "- Check IPFS status: ipfs id"
echo "- List IPFS keys: ipfs key list"
echo "- Monitor systemd service: sudo systemctl status rt-sysagent"
echo
print_status "Setup complete!" 