require('dotenv').config();
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.PROVIDER_URL);

const tokenAddress = '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c'; // BTCB
const myWallet = '0x150ba532074e5fcb1b3e8d36099b96625ebdf690';

async function main() {
  const logs = await provider.getLogs({
    fromBlock: 68414541,
    toBlock: 68414541,
    address: tokenAddress,
    topics: [ethers.id("Transfer(address,address,uint256)")]
  });

  const myLogs = logs.filter(log => {
    // decode topic[2] to an address
    const toAddress = '0x' + log.topics[2].slice(26);
    return toAddress.toLowerCase() === myWallet.toLowerCase();
  });

  if (!myLogs.length) {
    console.log("No deposit found in this block for your wallet.");
    return;
  }

  for (const log of myLogs) {
    const amount = ethers.BigNumber.from(log.data);
    console.log(`✅ Deposit detected! Amount: ${ethers.formatUnits(amount, 18)} BTCB`);
    console.log(`Transaction hash: ${log.transactionHash}`);
  }
}

main().catch(console.error);
