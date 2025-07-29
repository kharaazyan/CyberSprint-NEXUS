import fetch from 'node-fetch';
import ipfsService from './ipfsService.js';
import logger from './loggingService.js';
import configService from './configService.js';

class FetcherService {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  async loadConfig() {
    this.config = await configService.get('ipfs');
  }

  // Fetch data from IPFS gateway
  async fetchFromGateway(cid, gateway) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'Nexus-CLI'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Gateway responded with status ${response.status}`);
      }
      
      return await response.text();
    } catch (e) {
      throw new Error(`Gateway ${gateway} failed: ${e.message}`);
    }
  }

  // Fetch data from IPFS using gateway or local node
  async fetchFromIPFS(cid) {
    if (!this.config) await this.loadConfig();

    // Try gateways first in gateway mode
    if (this.config.connection_mode === 'gateway') {
      const errors = [];
      
      // Try main gateway
      try {
        return await this.fetchFromGateway(cid, this.config.gateway_url);
      } catch (e) {
        errors.push(`Main gateway error: ${e.message}`);
      }

      // Try fallback gateways
      if (this.config.use_fallback_gateways) {
        for (const gateway of this.config.fallback_gateways) {
          try {
            return await this.fetchFromGateway(cid, gateway);
          } catch (e) {
            errors.push(`Fallback gateway ${gateway} error: ${e.message}`);
            continue;
          }
        }
      }

      // Try local IPFS if all gateways fail
      try {
        return await ipfsService.getData(cid);
      } catch (err) {
        errors.push(`Local IPFS error: ${err.message}`);
        throw new Error(`All fetch attempts failed:\n${errors.join('\n')}`);
      }
    }
    
    // Try local IPFS first in API mode
    try {
      return await ipfsService.getData(cid);
    } catch (err) {
      logger.warn(`Local IPFS failed, trying gateways: ${err.message}`);
      
      // Try main gateway
      try {
        return await this.fetchFromGateway(cid, this.config.gateway_url);
      } catch (e) {
        // Try fallback gateways if main fails
        if (this.config.use_fallback_gateways) {
          for (const gateway of this.config.fallback_gateways) {
            try {
              return await this.fetchFromGateway(cid, gateway);
            } catch (e) {
              continue;
            }
          }
        }
        throw new Error(`Failed to fetch from IPFS: ${err.message}`);
      }
    }
  }

  // Resolve IPNS key to CID
  async resolveIPNSKey() {
    try {
      const config = await configService.get('ipfs');
      const resolvedCID = await ipfsService.resolveName(config.ipns_key_name);
      return resolvedCID;
    } catch (err) {
      throw new Error(`Failed to resolve IPNS key: ${err.message}`);
    }
  }
}

export default new FetcherService(); 