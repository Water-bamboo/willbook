# WishBook (Revive / Polkadot 2.0)

- Post a wish on-chain
- Donate to a wish
- Authors can withdraw donations (not exposed in the public UI)
- Frontend includes a polkadot.js (Substrate) panel for live demos

## Requirements

- Node.js 18+ (20+ recommended)
- (Optional) yarn
- Browser wallet (MetaMask, etc.)

## Install dependencies

Prefer yarn:

```bash
cd frontend
yarn
```

If yarn has permission/config issues on your machine (e.g. cannot write `~/.yarnrc`), use npm:

```bash
cd frontend
npm install
```

## Start frontend

```bash
cd frontend
npm run dev
```

Then open the printed local URL (default: http://localhost:5173/).

## Contract

Contract source: `contract/contract/WillBook.sol` (contract name: `WishBook`)

Core methods:
- `writeWish(string message)`: create a wish (non-empty, <= 2000 bytes)
- `donate(uint256 id)` (payable): donate to a wish
- `withdraw()`: withdraw the caller's `claimable`
- `claimable(address)`: withdrawable amount for an author
- `getWishes(offset, limit)`: reverse-ordered paginated list (includes `id`)

## Deploy contract (Revive / Polkadot Hub EVM JSON-RPC)

### 1) Configure .env

Create `contract/.env` (do not commit it):

```bash
cd contract
RPC_URL=https://services.polkadothub-rpc.com/testnet/
PRIVATE_KEY=your deploy private key (0x-prefixed)
```

Notes:
- `RPC_URL` is an EVM JSON-RPC (HTTP) endpoint used by Hardhat for deployment
- `PRIVATE_KEY` is the EVM private key used for deployment

### 2) Compile & test (optional but recommended)

```bash
cd contract
npm install
npm run compile
npm run test
```

### 3) Deploy

```bash
cd contract
npm run deploy
```

The terminal prints something like:

```
WishBook deployed to: 0x...
```

Copy this contract address into the "Contract Address" field in the frontend.

## Recommended RPC endpoints

### EVM JSON-RPC (HTTP, for Hardhat deployment)

Polkadot Hub TestNet (recommended):
- `https://eth-rpc-testnet.polkadot.io/`
- `https://services.polkadothub-rpc.com/testnet/`

Polkadot Hub (mainnet):
- `https://eth-rpc.polkadot.io/`
- `https://services.polkadothub-rpc.com/mainnet/`

Source: Polkadot Developer Docs (Network Details / RPC URL)
https://docs.polkadot.com/smart-contracts/connect/

### Substrate WSS (for the polkadot.js panel)

- `wss://rpc.polkadot.io`
- `wss://polkadot-asset-hub-rpc.polkadot.io`
- `wss://kusama-asset-hub-rpc.polkadot.io`
- `wss://asset-hub-paseo-rpc.n.dwellir.com`

Source: https://docs.polkadot.com/smart-contracts/connect/

## Frontend usage

![Screenshot](./doc/intro.png)

1. Open the frontend and click "Connect Wallet"
2. Paste the deployed contract address into "Contract Address"
3. (Optional) enter a signature and your wish content, then click "Submit on-chain"
4. Click "Donate", then enter the Wish ID and donation amount
5. Click "More" to load more wishes

## Demo checklist

Follow this order to reduce surprises during a live demo:

1. Prepare in advance:
   - A deployed contract address
   - A frontend URL (or run `npm run dev`)
   - A wallet funded with test tokens (gas for posting / donating / withdrawing)
2. If the network is unstable:
   - Switch WSS endpoint in the Polkadot.js panel (if enabled)
   - Use another HTTP RPC endpoint for Hardhat deployment
3. Talking points:
   - "Post a wish on-chain"
   - "Anyone can donate to support it"
   - "The author can withdraw at any time"
