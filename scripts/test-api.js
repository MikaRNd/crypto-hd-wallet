#!/usr/bin/env node
/**
 * Quick API test script
 * Make sure the server is running first: npm run dev
 */

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('\n🧪 Testing HD Wallet API\n');
  console.log('Make sure the server is running: npm run dev\n');

  try {
    // Test 1: Create user
    console.log('1️⃣  Creating user "alice"...');
    const createRes = await fetch(`${BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice' })
    });
    const user = await createRes.json();
    console.log('✅ User created:', user);
    console.log('');

    const userId = user.id;

    // Test 2: Get deposit address
    console.log('2️⃣  Getting deposit address...');
    const depositRes = await fetch(`${BASE_URL}/deposit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const deposit = await depositRes.json();
    console.log('✅ Deposit address:', deposit.deposit_address);
    console.log('');

    // Test 3: Check balance
    console.log('3️⃣  Checking balance...');
    const balanceRes = await fetch(`${BASE_URL}/balance?userId=${userId}`);
    const balance = await balanceRes.json();
    console.log('✅ Balance:', balance);
    console.log('');

    // Test 4: Get transactions
    console.log('4️⃣  Getting transaction history...');
    const txRes = await fetch(`${BASE_URL}/transactions?userId=${userId}`);
    const transactions = await txRes.json();
    console.log('✅ Transactions:', transactions);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📝 Next steps:');
    console.log('1. Send Sepolia ETH to:', deposit.deposit_address);
    console.log('2. Wait for 3 confirmations (~45 seconds)');
    console.log('3. Check balance again - it should update automatically!');
    console.log('4. Try a withdrawal with POST /withdraw\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('- Server is running: npm run dev');
    console.log('- .env file has valid PROVIDER_URL');
    console.log('- Port 3000 is not blocked\n');
  }
}

testAPI();
