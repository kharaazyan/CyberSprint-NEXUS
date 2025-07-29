#!/usr/bin/env node
import chalk from 'chalk';
import ora from 'ora';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import ipfsService from './services/ipfsService.js';
import fetcherService from './services/fetcherService.js';
import decryptorService from './services/decryptorService.js';
import configService from './services/configService.js';
import { parseAndSortLogs } from './services/utils.js';
import { startDaemon, stopDaemon } from './scripts/ipfs-daemon.js';
import { startServer } from './server.js';

let lastPrevCID = '';
let ipfsDaemon = null;
let rl = null;
let config = null;

// Load configuration
async function loadConfig() {
    if (!config) {
        config = {
            logging: await configService.get('logging')
        };
    }
    return config;
}

// Handle immediate exit on Ctrl+C
process.on('SIGINT', () => {
    console.log('\nForce closing...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nForce closing...');
    process.exit(0);
});

// Clean up resources before exit
async function cleanup() {
    if (rl) {
        rl.close();
    }
    if (ipfsDaemon) {
        await stopDaemon();
    }
}

// Create new command prompt
function createPrompt() {
    if (rl) {
        rl.close();
    }
    
    rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
    });

    rl.on('SIGINT', () => {
        console.log('\nForce closing...');
        process.exit(0);
    });

    return new Promise((resolve) => {
        rl.question(chalk.green('logcli> '), (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Handle CLI commands
async function handleCommand(cmd) {
    if (cmd === 'exit' || cmd === 'quit') {
        await cleanup();
        process.exit(0);
    }

    if (cmd === 'help' || cmd === '?') {
        console.log(chalk.yellow('╔═════════════════════════════════════════════════════════════════╗'));
        console.log(chalk.yellow('║                        Available Commands                       ║'));
        console.log(chalk.yellow('╠═════════════════════════════════════════════════════════════════╣'));
        console.log(chalk.yellow('║  fetch --resolve       Resolve IPNS and show latest CID         ║'));
        console.log(chalk.yellow('║  fetch <CID>           Fetch and decrypt a specific CID         ║'));
        console.log(chalk.yellow('║  fetch --chain         Fetch previous logs from last prev_cid   ║'));
        console.log(chalk.yellow('║  help / ?              Show this help message                   ║'));
        console.log(chalk.yellow('║  exit / quit           Exit the application                     ║'));
        console.log(chalk.yellow('╚═════════════════════════════════════════════════════════════════╝'));
        return;
    }

    if (cmd === 'fetch --resolve') {
        const spinner = ora('Fetching...').start();
        try {
            const resolvedCID = await ipfsService.resolveName();
            spinner.stop();
            console.log(resolvedCID);
            lastPrevCID = resolvedCID;
        } catch (e) {
            spinner.fail(e.message);
        }
        return;
    }

    if (cmd === 'fetch --chain') {
        if (!lastPrevCID) {
            console.log(chalk.red('No previous logs.'));
            return;
        }
        await handleFetch(lastPrevCID);
        return;
    }

    if (cmd.startsWith('fetch ')) {
        const cid = cmd.split(' ')[1];
        if (!cid) {
            console.log(chalk.yellow('Please provide a CID after "fetch".'));
            return;
        }
        await handleFetch(cid);
        return;
    }

    console.log(chalk.yellow('Unknown command. Type help'));
}

// Handle fetch command
async function handleFetch(cid) {
    const spinner = ora('Fetching...').start();
    try {
        // Get and decrypt data
        const raw = await fetcherService.fetchFromIPFS(cid);
        let data;
        try {
            data = await decryptorService.decryptAndParse(raw);
        } catch (e) {
            spinner.stop();
            if (e.message.includes('not valid JSON')) {
                console.log(chalk.red('[✘] Error: Response was not valid JSON — possibly invalid CID or IPFS error.'));
                console.log(chalk.red('[Raw Response]'));
                console.log(raw);
                return;
            }
            throw e;
        }

        spinner.stop();
        console.log(chalk.green('=== Decrypted Logs ==='));
        const logs = await parseAndSortLogs(data.logs);

        // Prepare log directory
        const cfg = await loadConfig();
        const logDir = path.resolve(process.cwd(), cfg.logging.log_dir || './logs');
        if (!fs.existsSync(logDir)) {
            await fs.mkdir(logDir, { recursive: true });
        }

        // Write logs to file
        const logFile = path.join(logDir, cfg.logging.output_file || 'logs_output.jsonl');
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        // Display and save logs
        for (const log of logs) {
            console.log(chalk.yellow('┌─────────────────────────────────────'));
            console.log(`│ Event ID : ${log.event_id}`);
            console.log(`│ Type     : ${log.type}`);
            console.log(`│ Message  : ${log.message}`);
            if (log.timestamp) {
                console.log(`│ Time     : ${log.timestamp}`);
            }
            console.log(chalk.yellow('└─────────────────────────────────────'));

            await logStream.write(JSON.stringify(log, null, cfg.logging.indent || 4) + '\n\n');
        }

        await logStream.end();

        // Handle previous CID
        lastPrevCID = data.prev_cid || '';
        console.log(chalk.cyan('⬅️  prev_cid:'), lastPrevCID);

        if (!lastPrevCID) {
            console.log(chalk.cyan('✔️  No more logs.'));
        } else {
            console.log(chalk.cyan('➡️  Type "fetch --chain" to load more logs...'));
        }
    } catch(e) {
        spinner.fail(e.message);
    }
}

// Main CLI loop
async function startCLI() {
    // Start IPFS daemon
    const spinner = ora('Starting IPFS daemon...').start();
    try {
        ipfsDaemon = await startDaemon();
        spinner.succeed('IPFS daemon started');
    } catch (error) {
        spinner.fail(`Failed to start IPFS daemon: ${error.message}`);
        process.exit(1);
    }

    await startServer()

    // Show welcome message
    console.log(chalk.cyan.bold(`\n  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗\n  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝\n  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗\n  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║\n  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║\n  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝`));
    console.log(chalk.yellow('═════════════════════════════════════════════════════════════════════════'));
    console.log('         🚀 Secure Log Management System | IPFS-Powered Analytics');
    console.log(chalk.yellow('═════════════════════════════════════════════════════════════════════════'));
    console.log(chalk.green('\nWelcome to Nexus CLI - Type "help" for commands\n'));

    // Main loop
    while (true) {
        try {
            const cmd = await createPrompt();
            await handleCommand(cmd);
        } catch (error) {
            if (error.code === 'SIGINT') {
                await cleanup();
                process.exit(0);
            }
            console.error(chalk.red('Error:'), error.message);
        }
    }
}

// Start CLI or handle command line arguments
if (process.argv[2] === 'shell') {
    startCLI().catch(console.error);
} else {
    // Parse command line arguments
    yargs(hideBin(process.argv))
        .command('fetch <identifier>', 'Fetch CID or IPNS', (y)=>{
            y.positional('identifier',{type:'string'})
             .option('resolve',{alias:'r',type:'boolean'})
             .option('chain',{type:'boolean',describe:'Load previous CID from last prev_cid'});
        }, async (args)=>{
            let cid = args.identifier;
            if(args.chain) {
                if(!lastPrevCID) {
                    console.log(chalk.red('No previous logs.'));
                    return;
                }
                cid = lastPrevCID;
            }
            if(args.resolve) {
                const spinner = ora('Fetching...').start();
                try {
                    const resolvedCID = await ipfsService.resolveName();
                    spinner.stop();
                    console.log(resolvedCID);
                    process.exit(0);
                } catch (e) {
                    spinner.fail(e.message);
                    process.exit(1);
                }
            } else {
                await handleFetch(cid);
                process.exit(0);
            }
        })
        .demandCommand()
        .help()
        .argv;
} 