#include <iostream>
#include <string>
#include "config.hpp"

int main(int argc [[maybe_unused]], char* argv[] [[maybe_unused]]) {
    try {
        std::cout << "RT-SysAgent Configuration Generator" << std::endl;
        std::cout << "===================================" << std::endl;
        
        // Initialize configuration
        Config::initialize_config();
        
        // Create default configuration
        Config::create_default_config();
        
        // Validate configuration
        if (Config::validate_config()) {
            std::cout << "✓ Configuration validation passed" << std::endl;
        } else {
            std::cout << "⚠ Configuration validation failed - some issues detected" << std::endl;
        }
        
        // Check required files
        if (Config::check_required_files()) {
            std::cout << "✓ Required files check passed" << std::endl;
        } else {
            std::cout << "⚠ Some required files are missing" << std::endl;
        }
        
        std::cout << std::endl;
        std::cout << "Configuration generated successfully!" << std::endl;
        std::cout << "Configuration file: " << Config::dirs.get_config_path() + "/settings.json" << std::endl;
        std::cout << std::endl;
        std::cout << "Next steps:" << std::endl;
        std::cout << "1. Generate RSA keys: openssl genrsa -out keys/private_key.pem 2048" << std::endl;
        std::cout << "2. Extract public key: openssl rsa -in keys/private_key.pem -pubout -out keys/public_key.pem" << std::endl;
        std::cout << "3. Initialize IPFS: ipfs init" << std::endl;
        std::cout << "4. Generate IPFS key: ipfs key gen log-agent --type=rsa --size=2048" << std::endl;
        std::cout << "5. Start IPFS daemon: ipfs daemon --routing=dhtclient" << std::endl;
        std::cout << "6. Build project: make all" << std::endl;
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
} 