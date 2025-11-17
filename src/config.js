const dotenv = require('dotenv');
dotenv.config();

const required = (key, optional = false) => {
  const v = process.env[key];
  if (!v && !optional) throw new Error(`Missing required env: ${key}`);
  return v;
};

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  network: process.env.NETWORK || 'sepolia',
  providerUrl: required('PROVIDER_URL'),
  masterXpub: required('MASTER_XPUB'),
  hotWalletPk: required('HOT_WALLET_PRIVATE_KEY'),
  confirmations: parseInt(process.env.REQUIRED_CONFIRMATIONS || '3', 10),
  dbPath: process.env.DATABASE_PATH || './data/wallet.db',
  // Optional maximum withdrawal limit (in ETH) -> exposed as wei BigInt
  maxWithdrawWei: process.env.MAX_WITHDRAW_ETH ? require('ethers').ethers.parseEther(process.env.MAX_WITHDRAW_ETH) : null,
};
