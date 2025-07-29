import { Buffer } from 'buffer';
import configService from './configService.js';

// Decode base64 string to buffer
function base64Decode(str) {
    return Buffer.from(str, 'base64');
}

// Parse log strings and sort by configured field
async function parseAndSortLogs(logsArray) {
    const config = await configService.get('logging');
    // Parse each log entry
    const logs = logsArray.map(s => {
        try {
            return typeof s === 'string' ? JSON.parse(s) : s;
        } catch (e) {
            // Create default log entry if parsing fails
            return {
                event_id: Date.now(),
                type: 'unknown',
                message: s,
                timestamp: new Date().toISOString()
            };
        }
    });

    // Get sort settings from config
    const sortField = config.sort_field || 'event_id';
    const sortOrder = config.sort_order || 'desc';
    
    // Sort logs by configured field and order
    return logs.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        
        if (sortOrder === 'desc') {
            return valB - valA;
        }
        return valA - valB;
    });
}

export { base64Decode, parseAndSortLogs }; 