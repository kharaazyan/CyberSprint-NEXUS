import fs from 'fs';
import crypto from 'crypto';
import { base64Decode } from './utils.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import configService from './configService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class DecryptorService {
  constructor() {
    this.config = null;
    this.loadConfig();
  }

  // Load encryption config
  async loadConfig() {
    this.config = await configService.get('encryption');
  }

  // Decrypt and parse encrypted JSON data
  async decryptAndParse(jsonData) {
    if (!this.config) await this.loadConfig();
    
    try {
      // Parse JSON if string
      const j = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

      // Check required fields
      if (!j.d || !j.k || !j.n || !j.t) {
        throw new Error('Missing required fields (d,k,n,t) in encrypted data');
      }

      // Decode base64 fields
      const d = base64Decode(j.d);  // Data
      const k = base64Decode(j.k);  // Key
      const n = base64Decode(j.n);  // IV
      const t = base64Decode(j.t);  // Auth tag

      // Check private key file
      const privateKeyPath = this.config.private_key_file;
      if (!fs.existsSync(privateKeyPath)) {
        throw new Error(`Cannot open private key file: ${privateKeyPath}`);
      }

      // Decrypt AES key with private key
      const privateKey = await fs.promises.readFile(privateKeyPath, 'utf-8');
      const aesKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: this.config.oaep_hash || 'sha256'
        },
        k
      );

      // Create decipher with AES key and IV
      const decipher = crypto.createDecipheriv(
        this.config.default_cipher,
        aesKey.slice(0, this.config.key_size / 8),
        n
      );
      
      // Set auth tag for GCM mode
      decipher.setAuthTag(t);

      try {
        // Decrypt and parse data
        const decrypted = Buffer.concat([decipher.update(d), decipher.final()]);
        return JSON.parse(decrypted.toString('utf-8'));
      } catch (e) {
        throw new Error('GCM decryption failed (bad tag?)');
      }
    } catch (e) {
      if (e.name === 'SyntaxError') {
        throw new Error('Response was not valid JSON — possibly invalid CID or IPFS error.');
      }
      throw e;
    }
  }
}

export default new DecryptorService(); 