#!/usr/bin/env node
/**
 * Helper script to generate wallet credentials for testing
 * Run: node scripts/generate-wallet.js
 * 
 * SECURITY: Use this ONLY for testnet. For production, use hardware wallet or KMS.
 */

const { ethers } = require('ethers');

console.log('\n🔐 Generating HD Wallet Credentials for Testing\n');
console.log('⚠️  WARNING: Use ONLY on testnet. Never use for mainnet!\n');

// Generate random mnemonic
const wallet = ethers.Wallet.createRandom();
const mnemonic = wallet.mnemonic.phrase;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📝 MNEMONIC (Store offline, encrypted, never share):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(mnemonic);
console.log('');

// Derive account at m/44'/60'/0'/0
const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic);
const accountNode = hdNode.derivePath("44'/60'/0'/0");

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔑 MASTER_XPUB (Put this in .env):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(accountNode.extendedKey);
console.log('');

// Generate hot wallet for withdrawals
const hotWallet = ethers.Wallet.createRandom();

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('💰 HOT WALLET (Put private key in .env):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Private Key:', hotWallet.privateKey);
console.log('Address:    ', hotWallet.address);
console.log('');

// Show example user addresses
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('👥 Example User Deposit Addresses:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
for (let i = 1; i <= 3; i++) {
  const userWallet = accountNode.deriveChild(i);
  console.log(`User ${i}: ${userWallet.address}`);
}
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📋 Next Steps:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('1. Copy MASTER_XPUB to .env file');
console.log('2. Copy HOT_WALLET_PRIVATE_KEY to .env file');
console.log('3. Get Sepolia testnet provider URL from:');
console.log('   - Infura: https://infura.io/');
console.log('   - Alchemy: https://www.alchemy.com/');
console.log('4. Fund hot wallet with Sepolia ETH:');
console.log('   - Faucet: https://sepoliafaucet.com/');
console.log('   - Address:', hotWallet.address);
console.log('5. Run: npm run dev');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
