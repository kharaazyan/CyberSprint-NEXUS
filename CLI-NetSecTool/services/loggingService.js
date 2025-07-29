import { createLogger, format, transports } from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import configService from './configService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class LoggingService {
    constructor() {
        this.config = null;
        this.logger = null;
        this.categoryLoggers = new Map();
        this.initialize();
    }

    async initialize() {
        this.config = await configService.get('logging');
        const logsDir = path.resolve(__dirname, '../logs');
        
        // Create logs directory if it doesn't exist
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Set up log format based on config
        const logFormat = this.config.format === 'json' 
            ? format.combine(format.timestamp(), format.json())
            : format.combine(
                format.timestamp(),
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    let msg = `${timestamp} [${level}]: ${message}`;
                    if (this.config.include_source && meta.source) {
                        msg = `${msg} (${meta.source})`;
                    }
                    if (this.config.source_location && meta.location) {
                        msg = `${msg} at ${meta.location}`;
                    }
                    return msg;
                })
            );

        const createTransports = () => {
            const list = [];

            // Add console transport if enabled
            if (this.config.enable_console) {
                list.push(new transports.Console({
                    format: format.combine(format.colorize(), format.simple())
                }));
            }

            // Add file transport if enabled
            if (this.config.enable_file) {
                list.push(new transports.File({
                    filename: this.config.log_file || path.join(logsDir, 'app.log'),
                    maxsize: this.config.max_log_size || 1024 * 1024,
                    maxFiles: this.config.max_log_files || 5,
                    tailable: true,
                    zippedArchive: this.config.log_rotation?.compress || false
                }));
            }

            return list;
        };

        // Create default logger
        this.logger = createLogger({
            level: this.config.log_level || 'info',
            format: logFormat,
            transports: createTransports()
        });

        // Create category-specific loggers
        if (this.config.categories) {
            Object.entries(this.config.categories).forEach(([category, level]) => {
                this.categoryLoggers.set(category, createLogger({
                    level,
                    format: logFormat,
                    transports: createTransports()
                }));
            });
        }
    }

    log(level, message, meta = {}) {
        if (!this.logger) return;
        
        // Use category logger if available
        if (meta.source && this.categoryLoggers.has(meta.source)) {
            this.categoryLoggers.get(meta.source).log(level, message, meta);
        } else {
            this.logger.log(level, message, meta);
        }
    }

    // Log error message
    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    // Log warning message
    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    // Log info message
    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    // Log debug message
    debug(message, meta = {}) {
        this.log('debug', message, meta);
    }

    // Reload logger configuration
    async reloadConfig() {
        await this.initialize();
    }
}

export default new LoggingService(); 