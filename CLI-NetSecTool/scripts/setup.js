import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import configService from '../services/configService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run shell command
async function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { stdio: 'inherit' });
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with code ${code}`));
        });
    });
}

async function setup() {
    console.log('Starting setup...');

    // Load configuration
    const config = await configService.get();

    // Create required directories
    const dirs = [
        config.logging.log_dir,
        path.dirname(config.encryption.private_key_file),
        path.dirname(config.encryption.ipns_key_file),
        config.encryption.backup_path,
        config.server.static_dir
    ];

    for (const dir of dirs) {
        const fullPath = path.resolve(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            console.log(`Creating directory: ${dir}`);
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }

    // Check IPFS installation
    try {
        await runCommand('ipfs', ['--version']);
    } catch (e) {
        console.error('IPFS is not installed. Please install it first.');
        console.log('Visit https://docs.ipfs.tech/install/command-line/ for installation instructions.');
        process.exit(1);
    }

    // Initialize IPFS if needed
    try {
        await runCommand('ipfs', ['init']);
    } catch (e) {
        // Ignore error if repository is already initialized
    }

    // Check and generate keys
    const privateKeyPath = path.resolve(process.cwd(), config.encryption.private_key_file);
    const ipnsKeyPath = path.resolve(process.cwd(), config.encryption.ipns_key_file);

    if (!fs.existsSync(privateKeyPath)) {
        console.log('Generating private key...');
        // Generate RSA private key
        await runCommand('openssl', [
            'genpkey',
            '-algorithm', 'RSA',
            '-out', privateKeyPath,
            '-pkeyopt', 'rsa_keygen_bits:2048'
        ]);
    }

    if (!fs.existsSync(ipnsKeyPath)) {
        console.log('Generating IPNS key...');
        try {
            // Create IPNS key
            const result = await runCommand('ipfs', [
                'key',
                'gen',
                '-t', 'rsa',
                '-b', config.ipfs.key_gen_bits.toString(),
                config.ipfs.ipns_key_name
            ]);
            
            // Save key to file
            const keyList = await runCommand('ipfs', ['key', 'list', '-l']);
            const keyLine = keyList.toString().split('\n').find(line => line.includes(config.ipfs.ipns_key_name));
            if (keyLine) {
                const peerId = keyLine.split(' ')[0];
                fs.writeFileSync(ipnsKeyPath, peerId);
            }
        } catch (e) {
            // Ignore error if key already exists
        }
    }

    // Install dependencies
    console.log('Checking dependencies...');
    await runCommand('npm', ['install']);

    // Run security audit
    console.log('Running security checks...');
    try {
        await runCommand('npm', ['audit']);
    } catch (e) {
        console.warn('Security vulnerabilities found. Please review npm audit output.');
    }

    // Generate documentation
    console.log('Generating documentation...');
    try {
        await runCommand('npm', ['run', 'build-docs']);
    } catch (e) {
        console.warn('Failed to generate documentation:', e.message);
    }

    console.log('\nSetup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Review configuration in config/settings.json');
    console.log('2. Start the application with: npm start');
    console.log('3. For development, use: npm run dev');
    console.log('\nFor more information, see README.md');
}

setup().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
}); 