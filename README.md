# 心愿簿 WishBook（Revive / Polkadot 2.0）

一个最小可用 Demo：
- 写心愿上链
- 给心愿作者捐款
- 作者提现捐款
- 前端附带 polkadot.js（Substrate）连接面板，用于现场展示链信息与区块高度

## 环境要求

- Node.js 18+（建议 20+）
-（可选）yarn
- 浏览器钱包（MetaMask 等）

## 安装依赖

优先尝试 yarn：

```bash
yarn
```

如果你本机 yarn 有权限/配置问题（例如无法写入 `~/.yarnrc`），直接用 npm：

```bash
npm install
```

## 启动前端

```bash
npm run dev
```

然后打开提示的本地地址（默认 http://localhost:5173/ ）。

## 合约说明

合约文件：`contracts/WillBook.sol`（合约名为 `WishBook`）

核心接口：
- `writeWish(string message)`：写心愿（非空，<=2000 字节）
- `donate(uint256 id)`（payable）：向某条心愿捐款
- `withdraw()`：作者提现自己的 `claimable`
- `claimable(address)`：作者可提现金额
- `getWishes(offset, limit)`：倒序分页读取心愿（包含 `id`）

## 部署合约（Revive / Polkadot Hub EVM JSON-RPC）

### 1) 配置 .env

在项目根目录新建 `.env`（不要提交到仓库）：

```bash
RPC_URL=https://services.polkadothub-rpc.com/testnet/
PRIVATE_KEY=你的部署私钥（0x 开头）
```

说明：
- `RPC_URL` 是 EVM JSON-RPC（HTTP）地址，用于 Hardhat 部署
- `PRIVATE_KEY` 用于部署的 EVM 私钥

### 2) 编译与测试（可选但建议）

```bash
npm run contract:compile
npm run contract:test
```

### 3) 部署

```bash
npm run contract:deploy
```

终端会输出：

```
WishBook deployed to: 0x...
```

把这个合约地址复制到前端页面的「合约地址」输入框即可交互。

## 推荐 RPC 列表

### EVM JSON-RPC（Hardhat 部署用，HTTP）

Polkadot Hub TestNet（推荐先用）：
- `https://eth-rpc-testnet.polkadot.io/`
- `https://services.polkadothub-rpc.com/testnet/`

Polkadot Hub（主网）：
- `https://eth-rpc.polkadot.io/`
- `https://services.polkadothub-rpc.com/mainnet/`

来源：Polkadot Developer Docs（Network Details / RPC URL）
https://docs.polkadot.com/smart-contracts/connect/

### Substrate WSS（polkadot.js 面板用）

- `wss://rpc.polkadot.io`
- `wss://polkadot-asset-hub-rpc.polkadot.io`
- `wss://kusama-asset-hub-rpc.polkadot.io`
- `wss://asset-hub-paseo-rpc.n.dwellir.com`

来源同上：https://docs.polkadot.com/smart-contracts/connect/

## 前端使用说明（演示流程）

1. 打开前端，点击「连接钱包」
2. 粘贴合约地址到「合约地址」
3. 在「写心愿」输入内容 → 点击「上链保存」
4. 在列表里给某条心愿填捐款金额 → 点击「捐款」
5. 切换到作者地址 → 点击「提现」

## 香港现场测试 Checklist

建议按这个顺序走，避免现场翻车：

1. 提前准备好：
   - 已部署的合约地址
   - 前端部署链接（或本地起 `npm run dev`）
   - 钱包里有测试代币（用于写心愿、捐款、提现 gas）
2. 现场网络不稳时：
   - 用前端的 Polkadot.js 面板切换 WSS
   - Hardhat 部署改用另一个 HTTP RPC
3. 演示口径：
   - “写心愿上链”
   - “其他人可以捐款支持”
   - “作者可随时提现”

