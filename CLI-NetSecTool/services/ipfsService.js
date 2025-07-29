import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import configService from './configService.js';
import logger from './loggingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run IPFS command with timeout
function runIpfs(args, timeout) {
    return new Promise((resolve, reject) => {
        const proc = spawn('ipfs', args);
        let stdout = '';
        let stderr = '';

        const timer = setTimeout(() => {
            proc.kill();
            reject(new Error(`IPFS command timed out after ${timeout}ms`));
        }, timeout);

        proc.stdout.on('data', (d) => (stdout += d));
        proc.stderr.on('data', (d) => (stderr += d));

        proc.on('close', (code) => {
            clearTimeout(timer);
            if (code === 0) return resolve(stdout.trim());
            reject(new Error(stderr.trim() || `ipfs exited with code ${code}`));
        });

        proc.on('error', (err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

class IpfsService {
    constructor() {
        this.config = null;
        this.loadConfig();
    }

    // Load IPFS and encryption config
    async loadConfig() {
        this.config = await configService.get('ipfs');
        this.encryption = await configService.get('encryption');
    }

    // Run IPFS command with retries
    async runWithRetry(args) {
        if (!this.config) await this.loadConfig();
        
        let lastError;
        for (let i = 0; i < this.config.max_retries; i++) {
            try {
                return await runIpfs(args, this.config.timeout);
            } catch (err) {
                lastError = err;
                if (i < this.config.max_retries - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        throw lastError;
    }

    // Add file to IPFS
    async addData(filePath) {
        const args = ['add', '-Q'];
        if (!this.config.pin_enabled) {
            args.push('--pin=false');
        }
        if (this.config.pin_recursive === false) {
            args.push('--recursive=false');
        }
        args.push(filePath);
        return this.runWithRetry(args);
    }

    // Get data from IPFS by CID
    async getData(cid) {
        try {
            logger.info('Fetching data from IPFS', { cid, operation: 'fetch' });

            const url = `https://ipfs.io/ipfs/${cid}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'curl/7.64.1',
                    'Accept': '*/*'
                },
                timeout: 30000
            });

            if (!response.ok) {
                const error = `HTTP error! status: ${response.status}`;
                logger.error('Failed to fetch from IPFS', { cid, error, operation: 'fetch' });
                throw new Error(error);
            }

            const text = await response.text();
            logger.info('Successfully fetched data from IPFS', { 
                cid, 
                operation: 'fetch',
                size: text.length,
                status: response.status
            });

            return text;
        } catch (err) {
            logger.error('Failed to fetch from IPFS', { 
                cid, 
                error: err.message, 
                operation: 'fetch',
                stack: err.stack
            });
            throw new Error(`Failed to fetch from IPFS: ${err.message}`);
        }
    }

    // Resolve IPNS name to CID
    async resolveName() {
        try {
            if (!this.config) await this.loadConfig();
            
            logger.info('Starting IPNS resolve', { operation: 'resolve' });

            // Read IPNS key from file
            const keyPath = path.resolve(process.cwd(), this.encryption.ipns_key_file);
            let peerId;
            try {
                peerId = await fs.readFile(keyPath, 'utf-8');
                peerId = peerId.trim();
                logger.debug('Read IPNS key from file', { keyPath, operation: 'resolve' });
            } catch (err) {
                logger.error('Failed to read IPNS key file', { 
                    keyPath, 
                    error: err.message, 
                    operation: 'resolve' 
                });
                throw new Error(`Cannot read IPNS key file: ${keyPath}`);
            }

            if (!peerId) {
                logger.error('Empty IPNS key file', { keyPath, operation: 'resolve' });
                throw new Error('IPNS key file is empty');
            }

            // Build resolve command
            const args = [
                'name',
                'resolve',
                '--nocache',
                '--timeout', this.config.name_resolve_timeout
            ];

            // Add offline flag if needed
            if (this.config.allow_offline) {
                args.push('--offline');
            }

            // Add IPNS path
            args.push(`/ipns/${peerId}`);

            logger.debug('Resolving IPNS name', { 
                peerId, 
                args, 
                operation: 'resolve',
                offline: this.config.allow_offline
            });

            // Run resolve
            const result = await this.runWithRetry(args);
            
            // Parse result
            const prefix = '/ipfs/';
            const pos = result.indexOf(prefix);
            if (pos === -1) {
                logger.error('Invalid resolve result', { 
                    result, 
                    operation: 'resolve' 
                });
                throw new Error(`Invalid resolve result: ${result}`);
            }

            const resolvedCid = result.substring(pos + prefix.length).trim();
            logger.info('Successfully resolved IPNS name', { 
                peerId, 
                resolvedCid, 
                operation: 'resolve' 
            });

            return resolvedCid;
        } catch (err) {
            // Add more context to error
            if (err.message.includes('no link named')) {
                logger.warn('IPNS name not published yet', { operation: 'resolve' });
                throw new Error('IPNS name not published yet. Please publish content first.');
            }
            logger.error('Failed to resolve IPNS name', { 
                error: err.message, 
                operation: 'resolve',
                stack: err.stack
            });
            throw new Error(`IPNS resolve failed: ${err.message}`);
        }
    }

    // List IPFS keys
    async listKeys() {
        const output = await this.runWithRetry(['key', 'list', '-l']);
        return output.split('\n')
            .filter(Boolean)
            .map(line => {
                // Format: k51qzi5uqu5dkml4vrxkesf5e1of62xic6s0un5bw4sq83f1av3jlotel9kpxs self
                // First part is key value, second is name
                const parts = line.trim().split(/\s+/);
                if (parts.length < 2) {
                    return line.trim(); // Return whole line if no space
                }
                // Last word is name, rest is value
                const name = parts[parts.length - 1];
                const value = parts.slice(0, -1).join(' ');
                return `${value} ${name}`; // Return in "value name" format
            });
    }

    // Create new IPFS key
    async createKey(name) {
        const args = [
            'key',
            'gen',
            '--type=rsa',
            '--size=2048',
            name
        ];
        return this.runWithRetry(args);
    }
}

export default new IpfsService(); 