#pragma once

#include <string>
#include <vector>
#include <map>
#include <optional>
#include <filesystem>

namespace Config {
    // === Project Metadata ===
    constexpr const char* PROJECT_NAME = "RT-SysAgent";
    constexpr const char* VERSION = "1.0.0";
    
    // === Build Configuration ===
    constexpr bool DEBUG_MODE = false;
    constexpr bool VERBOSE_LOGGING = false;
    
    // === Directory Structure ===
    struct Directories {
        std::string project_root;
        std::string src_dir = "src";
        std::string include_dir = "include";
        std::string build_dir = "build";
        std::string bin_dir = "bin";
        std::string dist_dir = "dist";
        std::string deps_dir = "deps";
        std::string external_dir = "external";
        std::string keys_dir = "keys";
        std::string tmp_dir = "tmp";
        std::string logs_dir = "logs";
        std::string config_dir = "config";
        
        Directories() {
            // Auto-detect project root
            project_root = std::filesystem::current_path().string();
        }
        
        std::string get_src_path() const { return project_root + "/" + src_dir; }
        std::string get_include_path() const { return project_root + "/" + include_dir; }
        std::string get_build_path() const { return project_root + "/" + build_dir; }
        std::string get_bin_path() const { return project_root + "/" + bin_dir; }
        std::string get_keys_path() const { return project_root + "/" + keys_dir; }
        std::string get_tmp_path() const { return project_root + "/" + tmp_dir; }
        std::string get_logs_path() const { return project_root + "/" + logs_dir; }
        std::string get_config_path() const { return project_root + "/" + config_dir; }
    };
    
    // === Queue Configuration ===
    struct QueueConfig {
        constexpr static size_t DEFAULT_QUEUE_SIZE = 16384;
        constexpr static size_t DEFAULT_TEXT_SIZE = 256;
        constexpr static size_t CACHE_LINE_SIZE = 64;
        constexpr static int MAX_RETRY_ATTEMPTS = 10000;
        constexpr static int YIELD_SLEEP_MS = 1;
    };
    
    // === Worker Configuration ===
    struct WorkerConfig {
        constexpr static int DEFAULT_NUM_WORKERS = 4;
        constexpr static int LOG_THRESHOLD = 50;
        constexpr static int TIME_THRESHOLD_SECONDS = 4;
        constexpr static int WORKER_SLEEP_MS = 1;
        constexpr static int FLUSHER_SLEEP_MS = 1000;
        constexpr static int MONITOR_POLL_MS = 500;
    };
    
    // === File Monitoring Configuration ===
    struct FileMonitorConfig {
        std::vector<std::string> watch_paths;
        constexpr static int INOTIFY_BUFFER_SIZE = 8192;
        constexpr static int INOTIFY_TIMEOUT_MS = 500;
        
        FileMonitorConfig() {
            // Default watch paths - can be overridden
            const char* home = std::getenv("HOME");
            if (home) {
                watch_paths = {
                    std::string(home) + "/Documents",
                    "/etc",
                    std::string(home) + "/Desktop"
                };
            } else {
                watch_paths = {"/etc", "/tmp"};
            }
        }
    };
    
    // === System Monitoring Configuration ===
    struct SystemMonitorConfig {
        std::string syslog_path = "/var/log/syslog";
        std::string journald_path = "/var/log/journal";
        constexpr static int SYSLOG_BUFFER_SIZE = 8192;
        constexpr static int USB_POLL_TIMEOUT_MS = 500;
    };
    
    // === IPFS Configuration ===
    struct IPFSConfig {
        std::string ipns_key_name = "log-agent";
        std::string ipfs_daemon_url = "http://localhost:5001";
        constexpr static int IPFS_TIMEOUT_SECONDS = 5;
        constexpr static int IPNS_TTL_SECONDS = 0;
        constexpr static bool ALLOW_OFFLINE = true;
        
        // IPFS URLs for installation
        constexpr static const char* IPFS_DOWNLOAD_URL = "https://dist.ipfs.tech/kubo/v0.22.0/kubo_v0.22.0_linux-amd64.tar.gz";
        constexpr static const char* NLOHMANN_JSON_URL = "https://github.com/nlohmann/json/releases/download/v3.12.0/json.hpp";
        constexpr static const char* AHO_CORASICK_URL = "https://raw.githubusercontent.com/cjgdev/aho_corasick/master/src/aho_corasick/aho_corasick.hpp";
    };
    
    // === Encryption Configuration ===
    struct EncryptionConfig {
        std::string private_key_path;
        std::string public_key_path;
        constexpr static int RSA_KEY_SIZE = 2048;
        constexpr static int AES_KEY_SIZE = 32;
        constexpr static int AES_IV_SIZE = 12;
        constexpr static int AES_TAG_SIZE = 16;
        constexpr static const char* RSA_PADDING = "RSA_PKCS1_OAEP_PADDING";
        
        EncryptionConfig() {
            private_key_path = "keys/private_key.pem";
            public_key_path = "keys/public_key.pem";
        }
    };
    
    // === Pattern Configuration ===
    struct PatternConfig {
        std::string pattern_file_path;
        std::vector<std::string> default_patterns;

        PatternConfig(){
            pattern_file_path = "tmp/pattern.txt";
            default_patterns = {
                "permission denied",
                "unauthorized access",
                "access denied",
                "authentication failure",
                "failed login",
                "invalid user",
                "segfault",
                "segmentation fault",
                "core dumped",
                "panic",
                "kernel panic",
                "oom-killer",
                "out of memory",
                "disk failure",
                "i/o error",
                "filesystem error",
                "mount failure",
                "device not ready",
                "usb disconnect",
                "usb device added",
                "connection refused",
                "network unreachable",
                "no route to host",
                "packet loss",
                "connection timeout",
                "port scan",
                "scan detected",
                "intrusion detected",
                "malware detected",
                "root access",
                "root login",
                "sudo failure",
                "failed password",
                "invalid password",
                "session opened",
                "session closed",
                "rejected",
                "blacklisted",
                "firewall drop",
                "iptables drop",
                "selinux violation",
                "audit failure",
                "kernel bug",
                "modprobe error",
                "service crash",
                "daemon died",
                "zombie process",
                "critical error",
                "fatal error",
                "systemd failure",
                "service failed",
                "watchdog timeout",
                "login attempt",
                "brute force",
                "login rate limit",
                "tcp reset",
                "dns spoof",
                "suspicious activity",
                "invalid certificate",
                "certificate expired",
                "key mismatch",
                "ssh disconnect",
                "ssh login failed",
                "ssh key rejected",
                "ransomware",
                "phishing",
                "trojan",
                "worm",
                "exploit",
                "buffer overflow",
                "heap corruption",
                "stack smash",
                "format string",
                "double free",
                "race condition",
                "memory leak",
                "unexpected reboot",
                "system halt",
                "service not found",
                "executable not found",
                "segmentation violation",
                "unknown device",
                "invalid configuration",
                "tampering",
                "configuration mismatch",
                "unexpected behavior",
                "error while loading shared libraries",
                "unable to resolve host",
                "failed to execute",
                "fork failed",
                "cannot allocate memory",
                "unhandled exception",
                "assertion failed",
                "invalid opcode",
                "illegal instruction",
                "trap divide error",
                "cpu soft lockup",
                "watchdog detected hard lockup",
                "clock skew",
                "time jump detected",
                "ntp error",
                "ntp time correction",
                "drift too large",
                "file not found",
                "no such file or directory",
                "read-only filesystem",
                "read error",
                "write error",
                "corrupted filesystem",
                "journal failure",
                "mounting failed",
                "disk quota exceeded",
                "inode exhaustion",
                "no space left on device",
                "device busy",
                "device error",
                "input/output error",
                "media failure",
                "firmware bug",
                "hardware error",
                "machine check error",
                "cpu overheating",
                "fan failure",
                "temperature threshold exceeded",
                "voltage out of range",
                "power supply failure",
                "battery failure",
                "acpi error",
                "bios error",
                "thermal event",
                "memory corruption",
                "dma error",
                "pci error",
                "usb enumeration failed",
                "device reset",
                "link down",
                "interface down",
                "interface reset",
                "network interface error",
                "packet corruption",
                "ip conflict",
                "dns error",
                "name resolution failure",
                "hostname lookup failure",
                "dhcp failure",
                "link flapping",
                "bridge loop detected",
                "network storm",
                "network congestion",
                "arp spoofing",
                "mac address conflict",
                "spoofed packet",
                "unexpected packet",
                "tcp handshake failed",
                "tcp retransmission",
                "ssl handshake failed",
                "tls alert",
                "tls negotiation failed",
                "certificate error",
                "expired certificate",
                "self-signed certificate",
                "untrusted certificate",
                "revoked certificate",
                "cipher mismatch",
                "invalid hostname",
                "proxy error",
                "vpn error",
                "tunnel failure",
                "ipsec negotiation failed",
                "route flapping",
                "routing table error",
                "bgp session dropped",
                "ospf adjacency lost",
                "icmp flood",
                "syn flood",
                "dos attack detected",
                "ddos attack",
                "malformed packet",
                "invalid header",
                "port unreachable",
                "service unavailable",
                "unknown protocol",
                "log tampering",
                "log rotation failed",
                "auditd buffer overflow",
                "selinux alert",
                "apparmor violation",
                "container exited unexpectedly",
                "container restart loop",
                "docker daemon error",
                "kubelet error",
                "kubernetes api error",
                "pod eviction",
                "taint detected",
                "node not ready",
                "kube-apiserver crash",
                "etcd connection failed"
            };
        }
    };
    
    // === Logging Configuration ===
    struct LoggingConfig {
        std::string log_file_path;
        constexpr static bool ENABLE_CONSOLE_LOGGING = true;
        constexpr static bool ENABLE_FILE_LOGGING = true;
        constexpr static int MAX_LOG_FILE_SIZE_MB = 100;
        constexpr static int MAX_LOG_FILES = 5;
        
        LoggingConfig() {
            log_file_path = "logs/rt-sysagent.log";
        }
    };
    
    // === Shared Memory Configuration ===
    struct SharedMemoryConfig {
        std::string queue_file_path;
        constexpr static int FILE_PERMISSIONS = 0666;
        constexpr static bool CREATE_IF_NOT_EXISTS = true;
        
        SharedMemoryConfig() {
            queue_file_path = "tmp/event_queue_shm";
        }
    };
    
    // === Systemd Configuration ===
    struct SystemdConfig {
        constexpr static bool ENABLE_SYSTEMD_INTEGRATION = true;
        constexpr static int WATCHDOG_TIMEOUT_MS = 200;
        constexpr static const char* SERVICE_NAME = "rt-sysagent";
        constexpr static const char* SERVICE_DESCRIPTION = "Real-Time System Monitoring Agent";
    };
    
    // === Global Configuration Instance ===
    extern Directories dirs;
    extern FileMonitorConfig file_monitor;
    extern SystemMonitorConfig system_monitor;
    extern IPFSConfig ipfs;
    extern EncryptionConfig encryption;
    extern PatternConfig patterns;
    extern LoggingConfig logging;
    extern SharedMemoryConfig shared_memory;
    
    // === Configuration Management ===
    void initialize_config();
    void load_config_from_file(const std::string& config_file = "config/settings.json");
    void save_config_to_file(const std::string& config_file = "config/settings.json");
    void create_default_config();
    
    // === Utility Functions ===
    std::string get_project_root();
    std::string get_absolute_path(const std::string& relative_path);
    bool ensure_directory_exists(const std::string& path);
    std::vector<std::string> get_environment_paths();
    
    // === Validation Functions ===
    bool validate_config();
    bool check_required_files();
    bool check_required_directories();
    bool check_ipfs_installation();
    bool check_system_dependencies();
} 