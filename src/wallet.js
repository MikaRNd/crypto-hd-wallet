const { HDNodeWallet, ethers } = require('ethers');
const { masterXpub } = require('./config');

// Derivation path base: m/44'/60'/0'/0/{index}
function pathForUser(userId) {
  if (!Number.isInteger(userId) || userId < 0) throw new Error('Invalid userId for derivation');
  return `m/44'/60'/0'/0/${userId}`;
}

function addressFromXpubAtIndex(xpub, index) {
  const node = HDNodeWallet.fromExtendedKey(xpub);
  const child = node.deriveChild(index); // xpub is expected to be at m/44'/60'/0'/0
  return ethers.getAddress(child.address);
}

function getDepositAddress(userId) {
  // Expect masterXpub corresponds to m/44'/60'/0'/0
  const index = userId; // 1:1 mapping
  return addressFromXpubAtIndex(masterXpub, index);
}

module.exports = {
  pathForUser,
  getDepositAddress,
};
