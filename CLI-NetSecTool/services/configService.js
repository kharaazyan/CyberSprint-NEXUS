import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const settingsPath = path.resolve(__dirname, '../config/settings.json');

class ConfigService {
    constructor() {
        this._cache = null;
        this._watchers = new Set();
    }

    // Load config from file
    async _load() {
        if (this._cache) return this._cache;
        const raw = await fs.readFile(settingsPath, 'utf-8');
        this._cache = JSON.parse(raw);
        return this._cache;
    }

    // Get config value by key
    async get(key) {
        const cfg = await this._load();
        if (!key) return cfg;
        return key.split('.').reduce((acc, cur) => (acc ? acc[cur] : undefined), cfg);
    }

    // Set config value by key
    async set(key, value) {
        const cfg = await this._load();
        const parts = key.split('.');
        let cur = cfg;
        for (let i = 0; i < parts.length - 1; i++) {
            const p = parts[i];
            if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
            cur = cur[p];
        }
        cur[parts[parts.length - 1]] = value;
        await this.save();
    }

    // Save new config with validation and backup
    async saveConfig(newConfig) {
        // Validate the new config
        if (!this._validateConfig(newConfig)) {
            throw new Error('Invalid configuration format');
        }

        // Create backup
        const backupPath = `${settingsPath}.backup`;
        try {
            await fs.copyFile(settingsPath, backupPath);
        } catch (error) {
            console.warn('Failed to create config backup:', error);
        }

        try {
            // Save new config
            await fs.writeFile(settingsPath, JSON.stringify(newConfig, null, 2));
            this._cache = newConfig;

            // Notify watchers
            this._notifyWatchers();

            // Remove backup on success
            try {
                await fs.unlink(backupPath);
            } catch (error) {
                console.warn('Failed to remove config backup:', error);
            }
        } catch (error) {
            // Restore backup on error
            try {
                await fs.copyFile(backupPath, settingsPath);
                const backup = await fs.readFile(backupPath, 'utf-8');
                this._cache = JSON.parse(backup);
            } catch (restoreError) {
                throw new Error(`Failed to save config and restore backup: ${error.message}, ${restoreError.message}`);
            }
            throw error;
        }
    }

    // Save current config
    async save() {
        if (!this._cache) return;
        await this.saveConfig(this._cache);
    }

    // Validate config structure and types
    _validateConfig(config) {
        // Check if it's an object
        if (!config || typeof config !== 'object') return false;

        // Required sections
        const requiredSections = [
            'network', 
            'server', 
            'ipfs', 
            'encryption', 
            'logging',
            'security',
            'performance'
        ];

        for (const section of requiredSections) {
            if (!config[section] || typeof config[section] !== 'object') {
                console.error(`Missing or invalid section: ${section}`);
                return false;
            }
        }

        // Network section
        const network = config.network;
        if (!this._validateNetworkSection(network)) return false;

        // Server section
        const server = config.server;
        if (!this._validateServerSection(server)) return false;

        // IPFS section
        const ipfs = config.ipfs;
        if (!this._validateIpfsSection(ipfs)) return false;

        // Encryption section
        const encryption = config.encryption;
        if (!this._validateEncryptionSection(encryption)) return false;

        // Logging section
        const logging = config.logging;
        if (!this._validateLoggingSection(logging)) return false;

        // Security section
        const security = config.security;
        if (!this._validateSecuritySection(security)) return false;

        // Performance section
        const performance = config.performance;
        if (!this._validatePerformanceSection(performance)) return false;

        return true;
    }

    // Validate network settings
    _validateNetworkSection(network) {
        const requiredFields = [
            'default_port',
            'default_host',
            'connection_timeout',
            'max_retries',
            'process_kill_timeout',
            'cleanup_wait_timeout',
            'daemon_shutdown_timeout',
            'stats_update_interval',
            'ping_timeout',
            'interface_speed_detection'
        ];

        for (const field of requiredFields) {
            if (network[field] === undefined) {
                console.error(`Missing network field: ${field}`);
                return false;
            }
        }

        if (typeof network.default_port !== 'number' ||
            typeof network.default_host !== 'string' ||
            typeof network.connection_timeout !== 'number' ||
            typeof network.max_retries !== 'number') {
            console.error('Invalid network field types');
            return false;
        }

        return true;
    }

    // Validate server settings
    _validateServerSection(server) {
        const requiredFields = [
            'port',
            'host',
            'static_dir',
            'api_prefix',
            'cors',
            'rate_limit'
        ];

        for (const field of requiredFields) {
            if (server[field] === undefined) {
                console.error(`Missing server field: ${field}`);
                return false;
            }
        }

        if (typeof server.port !== 'number' ||
            typeof server.host !== 'string' ||
            typeof server.static_dir !== 'string' ||
            typeof server.api_prefix !== 'string') {
            console.error('Invalid server field types');
            return false;
        }

        return true;
    }

    // Validate IPFS settings
    _validateIpfsSection(ipfs) {
        const requiredFields = [
            'api_url',
            'timeout',
            'max_retries',
            'allow_offline',
            'allow_online',
            'pin_enabled',
            'name_resolve_timeout',
            'pid_file'
        ];

        for (const field of requiredFields) {
            if (ipfs[field] === undefined) {
                console.error(`Missing IPFS field: ${field}`);
                return false;
            }
        }

        if (typeof ipfs.api_url !== 'string' ||
            typeof ipfs.timeout !== 'number' ||
            typeof ipfs.max_retries !== 'number' ||
            typeof ipfs.allow_offline !== 'boolean' ||
            typeof ipfs.allow_online !== 'boolean' ||
            typeof ipfs.pin_enabled !== 'boolean') {
            console.error('Invalid IPFS field types');
            return false;
        }

        return true;
    }

    // Validate encryption settings
    _validateEncryptionSection(encryption) {
        const requiredFields = [
            'default_cipher',
            'key_size',
            'private_key_file',
            'ipns_key_file',
            'key_derivation',
            'pbkdf2_iterations',
            'pbkdf2_digest',
            'backup_path'
        ];

        for (const field of requiredFields) {
            if (encryption[field] === undefined) {
                console.error(`Missing encryption field: ${field}`);
                return false;
            }
        }

        if (typeof encryption.private_key_file !== 'string' ||
            typeof encryption.ipns_key_file !== 'string' ||
            typeof encryption.key_size !== 'number' ||
            typeof encryption.pbkdf2_iterations !== 'number') {
            console.error('Invalid encryption field types');
            return false;
        }

        return true;
    }

    // Validate logging settings
    _validateLoggingSection(logging) {
        const requiredFields = [
            'log_file',
            'log_level',
            'max_log_size',
            'max_log_files',
            'enable_console',
            'enable_file',
            'format',
            'timestamp_format',
            'log_dir',
            'output_file',
            'error_handling',
            'log_rotation',
            'categories'
        ];

        for (const field of requiredFields) {
            if (logging[field] === undefined) {
                console.error(`Missing logging field: ${field}`);
                return false;
            }
        }

        if (typeof logging.log_file !== 'string' ||
            typeof logging.log_level !== 'string' ||
            typeof logging.enable_console !== 'boolean' ||
            typeof logging.enable_file !== 'boolean') {
            console.error('Invalid logging field types');
            return false;
        }

        return true;
    }

    // Validate security settings
    _validateSecuritySection(security) {
        const requiredFields = [
            'rate_limiting',
            'cors',
            'api_keys',
            'ip_whitelist'
        ];

        for (const field of requiredFields) {
            if (security[field] === undefined) {
                console.error(`Missing security field: ${field}`);
                return false;
            }
        }

        return true;
    }

    // Validate performance settings
    _validatePerformanceSection(performance) {
        const requiredFields = [
            'cache',
            'compression',
            'batch_processing'
        ];

        for (const field of requiredFields) {
            if (performance[field] === undefined) {
                console.error(`Missing performance field: ${field}`);
                return false;
            }
        }

        return true;
    }

    // Watch for config changes
    addWatcher(callback) {
        this._watchers.add(callback);
    }

    // Remove config change watcher
    removeWatcher(callback) {
        this._watchers.delete(callback);
    }

    // Notify watchers about config changes
    _notifyWatchers() {
        for (const watcher of this._watchers) {
            try {
                watcher(this._cache);
            } catch (error) {
                console.error('Error in config watcher:', error);
            }
        }
    }

    // Clear config cache
    clearCache() {
        this._cache = null;
    }
}

export default new ConfigService(); 