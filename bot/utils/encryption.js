import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Get encryption key from environment variables or use a default (not recommended for production)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'simbi-default-encryption-key-32chars';

// Check if the encryption key is long enough (32 bytes for AES-256)
if (ENCRYPTION_KEY.length < 32) {
  console.warn('WARNING: Encryption key is too short. It should be at least 32 characters for AES-256 encryption.');
}

// Function to encrypt a private key
export function encryptPrivateKey(privateKey) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher with key and iv
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)), 
      iv
    );
    
    // Encrypt the private key
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return iv and encrypted data together
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt private key');
  }
}

// Function to decrypt a private key
export function decryptPrivateKey(encryptedData) {
  try {
    // Split the iv and encrypted parts
    const [ivHex, encryptedHex] = encryptedData.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    
    // Create decipher with key and iv
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY.slice(0, 32)), 
      iv
    );
    
    // Decrypt the private key
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt private key');
  }
}

// Helper function to check if a string is already encrypted
export function isEncrypted(data) {
  // Check if the data matches the pattern of our encrypted data (iv:encryptedData)
  const pattern = /^[0-9a-f]{32}:[0-9a-f]+$/i;
  return pattern.test(data);
} 