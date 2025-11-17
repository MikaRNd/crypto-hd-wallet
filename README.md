# Crypto HD Wallet Service

Secure service that issues unique user deposit addresses via HD wallets, detects deposits, maintains an off-chain ledger, and processes withdrawals from a hot wallet.

## Features
- Master HD wallet with xpub-only address derivation (no private keys online)
- Unique deposit address per user: `m/44'/60'/0'/0/{userId}`
- Deposit listener with N-confirmations and reorg safety
- Off-chain ledger in SQLite
- Secure withdrawals from a limited hot wallet
- REST API endpoints

## Quick Start
1. Create directory and copy env
```bash
cp .env.example .env
```
2. Fill `.env`:
- `PROVIDER_URL` (Infura/Alchemy URL)
- `MASTER_XPUB` (account xpub for path `m/44'/60'/0'/0`)
- `HOT_WALLET_PRIVATE_KEY` (testnet key) 
- Adjust `REQUIRED_CONFIRMATIONS`, `DATABASE_PATH`, `PORT`0000000 
3. Install deps and run
```bash
npm install
npm run dev
```

## API
- POST /users { username }
- GET /balance?userId=ID
- POST /deposit { userId } → returns deposit address
- POST /withdraw { userId, to, amountEth }
- GET /transactions?userId=ID

Amounts are handled internally in wei. `amountEth` is a string like "0.05".

## Security Notes
- Master mnemonic/seed is offline. Only `MASTER_XPUB` is online.
- Hot wallet is separate and limited.
- Env variables loaded via `dotenv`; do not commit real secrets.
- Listener only credits after N confirmations to avoid reorg risks.

## Testnet
- Use `sepolia` or another testnet provider URL.
- Fund hot wallet with small testnet amounts only.

## Data
SQLite at `DATABASE_PATH`. Auto-migrates on startup. Back up the DB.
