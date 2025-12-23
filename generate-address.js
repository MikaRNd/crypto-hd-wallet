const wallet = require('./src/wallet');

// Get user ID from command line arguments or use 1 as default
const userId = process.argv[2] ? parseInt(process.argv[2]) : 1;

if (isNaN(userId) || userId < 0) {
  console.error('Error: User ID must be a non-negative number');
  process.exit(1);
}

try {
  const address = wallet.getDepositAddress(userId);
  console.log(`\nGenerated Address for User ID ${userId}:`);
  console.log('----------------------------------');
  console.log(`Address: ${address}`);
  console.log(`Derivation Path: ${wallet.pathForUser(userId)}`);
  console.log('----------------------------------\n');
} catch (error) {
  console.error('Error generating address:', error.message);
  process.exit(1);
}
