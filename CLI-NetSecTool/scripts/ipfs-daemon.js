import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import configService from '../services/configService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let daemonProcess = null;

// Find running IPFS processes
async function findIpfsProcesses() {
    try {
        const { exec } = await import('child_process');
        return new Promise((resolve, reject) => {
            exec('ps aux | grep ipfs | grep -v grep', (error, stdout) => {
                if (error && error.code !== 1) {
                    reject(error);
                    return;
                }
                const processes = stdout.split('\n')
                    .filter(Boolean)
                    .map(line => {
                        const parts = line.split(/\s+/);
                        return { pid: parseInt(parts[1]), cmd: parts.slice(10).join(' ') };
                    });
                resolve(processes);
            });
        });
    } catch (error) {
        console.error('Error finding IPFS processes:', error);
        return [];
    }
}

// Kill process with given PID
async function killProcess(pid, signal = 'SIGTERM') {
    try {
        process.kill(pid, signal);
        // Wait for process to end
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Check if process is still alive
        try {
            process.kill(pid, 0);
            // If still alive, use SIGKILL
            process.kill(pid, 'SIGKILL');
        } catch (e) {
            // Process already dead
        }
    } catch (error) {
        console.error(`Failed to kill process ${pid}:`, error);
    }
}

// Clean up IPFS lock files
async function cleanupLock() {
    const config = await configService.get();
    const repoLock = path.join(process.env.HOME, '.ipfs', 'repo.lock');
    const dataStoreLock = path.join(process.env.HOME, '.ipfs', 'datastore', 'LOCK');
    
    try {
        await fs.unlink(repoLock).catch(() => {});
        await fs.unlink(dataStoreLock).catch(() => {});
    } catch (error) {
        console.error('Error cleaning up locks:', error);
    }
}

// Clean up PID file
async function cleanupPid() {
    const config = await configService.get();
    try {
        await fs.unlink(config.ipfs.pid_file).catch(() => {});
    } catch (error) {
        console.error('Error cleaning up PID file:', error);
    }
}

// Kill any existing IPFS daemon
async function killExistingDaemon() {
    const processes = await findIpfsProcesses();
    for (const proc of processes) {
        await killProcess(proc.pid);
    }
}

// Start IPFS daemon
export async function startDaemon() {
    const config = await configService.get();
    
    // Kill existing daemon if any
    await killExistingDaemon();
    
    // Clean up lock files
    await cleanupLock();
    await cleanupPid();
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, config.network.cleanup_wait_timeout));

    // Basic arguments
    const args = ['daemon'];

    // Add offline mode if needed
    if (!config.ipfs.allow_online) {
        args.push('--offline');
    }

    // Add routing
    args.push('--routing=dhtclient');

    // Start process
    daemonProcess = spawn('ipfs', args, {
        stdio: 'pipe',
        detached: true
    });

    // Save PID
    await fs.writeFile(config.ipfs.pid_file, daemonProcess.pid.toString());

    return new Promise((resolve, reject) => {
        let started = false;
        let error = null;

        const cleanup = () => {
            daemonProcess.stdout.removeAllListeners();
            daemonProcess.stderr.removeAllListeners();
            daemonProcess.removeAllListeners();
        };

        daemonProcess.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('Daemon is ready')) {
                started = true;
                cleanup();
                resolve();
            }
        });

        daemonProcess.stderr.on('data', (data) => {
            error = data.toString();
            console.error('IPFS Daemon Error:', error);
        });

        daemonProcess.on('error', (err) => {
            cleanup();
            reject(err);
        });

        daemonProcess.on('exit', (code) => {
            if (!started) {
                cleanup();
                reject(new Error(`IPFS daemon exited with code ${code}\n${error || ''}`));
            }
        });

        // Start timeout
        setTimeout(() => {
            if (!started) {
                cleanup();
                killProcess(daemonProcess.pid, 'SIGKILL');
                reject(new Error('IPFS daemon startup timeout'));
            }
        }, config.ipfs.daemon_startup_timeout);
    });
}

// Stop IPFS daemon
export async function stopDaemon() {
    if (daemonProcess) {
        const config = await configService.get();
        
        // Try graceful stop
        await killProcess(daemonProcess.pid, 'SIGTERM');
        
        // Wait for shutdown
        await new Promise(resolve => setTimeout(resolve, config.network.daemon_shutdown_timeout));
        
        // Kill if still alive
        await killProcess(daemonProcess.pid, 'SIGKILL');
        
        // Clean up files
        await cleanupPid();
        await cleanupLock();
        
        daemonProcess = null;
    }
} 