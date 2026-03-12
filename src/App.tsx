import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther, type Eip1193Provider } from "ethers";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { getContractAddress, WISHBOOK_ABI } from "./contract";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type WishEntry = {
  id: bigint;
  author: string;
  createdAt: bigint;
  message: string;
};

function getStoredContractAddress(): string | null {
  const key = "wishbook_address";
  const value = localStorage.getItem(key);
  return value?.trim() ? value.trim() : null;
}

function setStoredContractAddress(address: string) {
  const key = "wishbook_address";
  localStorage.setItem(key, address.trim());
}

function toErrorText(e: unknown): string {
  if (typeof e === "object" && e) {
    const record = e as Record<string, unknown>;
    const shortMessage = record["shortMessage"];
    if (typeof shortMessage === "string" && shortMessage.trim()) return shortMessage;
    const message = record["message"];
    if (typeof message === "string" && message.trim()) return message;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function App() {
  const [contractAddress, setContractAddress] = useState<string | null>(
    () => getContractAddress() ?? getStoredContractAddress()
  );
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const apiRef = useRef<ApiPromise | null>(null);
  const apiUnsubRef = useRef<null | (() => void)>(null);
  const [polkadotRpc, setPolkadotRpc] = useState("wss://rpc.polkadot.io");
  const [polkadotConnecting, setPolkadotConnecting] = useState(false);
  const [polkadotConnected, setPolkadotConnected] = useState(false);
  const [polkadotError, setPolkadotError] = useState<string | null>(null);
  const [polkadotInfo, setPolkadotInfo] = useState<{
    chain: string;
    node: string;
    version: string;
    specName: string;
  } | null>(null);
  const [polkadotFinalized, setPolkadotFinalized] = useState<number | null>(null);

  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [donatingId, setDonatingId] = useState<bigint | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [donationEth, setDonationEth] = useState("0.01");
  const [claimableEth, setClaimableEth] = useState<string | null>(null);

  const [wishes, setWishes] = useState<WishEntry[]>([]);

  const contractRead = useMemo(() => {
    if (!provider || !contractAddress) return null;
    return new Contract(contractAddress, WISHBOOK_ABI, provider);
  }, [provider, contractAddress]);

  const connectWallet = useCallback(async () => {
    setErrorText(null);
    if (!window.ethereum) {
      setErrorText("没检测到钱包扩展（MetaMask 等）。");
      return;
    }

    const nextProvider = new BrowserProvider(window.ethereum);
    await nextProvider.send("eth_requestAccounts", []);

    const signer = await nextProvider.getSigner();
    const address = await signer.getAddress();
    const network = await nextProvider.getNetwork();
    const bal = await nextProvider.getBalance(address);

    setProvider(nextProvider);
    setAccount(address);
    setChainId(network.chainId.toString());
    setBalance(formatEther(bal));
  }, []);

  const disconnectPolkadot = useCallback(async () => {
    setPolkadotError(null);
    try {
      if (apiUnsubRef.current) {
        apiUnsubRef.current();
        apiUnsubRef.current = null;
      }
      if (apiRef.current) {
        await apiRef.current.disconnect();
        apiRef.current = null;
      }
    } catch (e: unknown) {
      setPolkadotError(toErrorText(e));
    } finally {
      setPolkadotConnected(false);
      setPolkadotInfo(null);
      setPolkadotFinalized(null);
    }
  }, []);

  const connectPolkadot = useCallback(async () => {
    setPolkadotError(null);
    setPolkadotConnecting(true);
    try {
      await disconnectPolkadot();
      const wsProvider = new WsProvider(polkadotRpc);
      const api = await ApiPromise.create({ provider: wsProvider });
      apiRef.current = api;

      const [chain, node, version] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.name(),
        api.rpc.system.version()
      ]);

      setPolkadotInfo({
        chain: chain.toString(),
        node: node.toString(),
        version: version.toString(),
        specName: api.runtimeVersion.specName.toString()
      });
      setPolkadotConnected(true);

      const unsub = await api.rpc.chain.subscribeFinalizedHeads((header) => {
        setPolkadotFinalized(header.number.toNumber());
      });
      apiUnsubRef.current = unsub;
    } catch (e: unknown) {
      setPolkadotError(toErrorText(e));
      setPolkadotConnected(false);
      setPolkadotInfo(null);
      setPolkadotFinalized(null);
    } finally {
      setPolkadotConnecting(false);
    }
  }, [disconnectPolkadot, polkadotRpc]);

  const loadWishes = useCallback(
    async (opts?: { offset?: number; limit?: number }) => {
      if (!contractRead) return;
      setErrorText(null);
      setLoading(true);
      try {
        const offset = BigInt(opts?.offset ?? 0);
        const limit = BigInt(opts?.limit ?? 50);
        const page: WishEntry[] = await contractRead.getWishes(offset, limit);
        setWishes(page);
      } catch (e: unknown) {
        setErrorText(toErrorText(e));
      } finally {
        setLoading(false);
      }
    },
    [contractRead]
  );

  const loadClaimable = useCallback(async () => {
    if (!contractRead || !account) return;
    try {
      const raw: bigint = await contractRead.claimable(account);
      setClaimableEth(formatEther(raw));
    } catch {
      setClaimableEth(null);
    }
  }, [contractRead, account]);

  const postWish = useCallback(async () => {
    if (!provider || !account) {
      setErrorText("请先连接钱包。");
      return;
    }
    if (!contractAddress) {
      setErrorText("请先填写合约地址。");
      return;
    }
    if (!message.trim()) {
      setErrorText("心愿不能为空。");
      return;
    }

    setErrorText(null);
    setPosting(true);
    try {
      const signer = await provider.getSigner();
      const contractWrite = new Contract(contractAddress, WISHBOOK_ABI, signer);
      const tx = await contractWrite.writeWish(message.trim());
      await tx.wait();
      setMessage("");
      await loadWishes({ offset: 0, limit: 50 });
    } catch (e: unknown) {
      setErrorText(toErrorText(e));
    } finally {
      setPosting(false);
    }
  }, [provider, account, contractAddress, message, loadWishes]);

  const donateToWish = useCallback(
    async (id: bigint) => {
      if (!provider || !account) {
        setErrorText("请先连接钱包。");
        return;
      }
      if (!contractAddress) {
        setErrorText("请先填写合约地址。");
        return;
      }

      setErrorText(null);
      setDonatingId(id);
      try {
        const amount = parseEther(donationEth || "0");
        if (amount <= 0n) {
          setErrorText("捐款金额必须大于 0。");
          return;
        }
        const signer = await provider.getSigner();
        const contractWrite = new Contract(contractAddress, WISHBOOK_ABI, signer);
        const tx = await contractWrite.donate(id, { value: amount });
        await tx.wait();
        await loadClaimable();
      } catch (e: unknown) {
        setErrorText(toErrorText(e));
      } finally {
        setDonatingId(null);
      }
    },
    [provider, account, contractAddress, donationEth, loadClaimable]
  );

  const withdraw = useCallback(async () => {
    if (!provider || !account) {
      setErrorText("请先连接钱包。");
      return;
    }
    if (!contractAddress) {
      setErrorText("请先填写合约地址。");
      return;
    }

    setErrorText(null);
    setWithdrawing(true);
    try {
      const signer = await provider.getSigner();
      const contractWrite = new Contract(contractAddress, WISHBOOK_ABI, signer);
      const tx = await contractWrite.withdraw();
      await tx.wait();
      await loadClaimable();
    } catch (e: unknown) {
      setErrorText(toErrorText(e));
    } finally {
      setWithdrawing(false);
    }
  }, [provider, account, contractAddress, loadClaimable]);

  useEffect(() => {
    if (!provider) return;
    void loadWishes({ offset: 0, limit: 50 });
  }, [provider, loadWishes]);

  useEffect(() => {
    if (!provider || !account) return;
    void loadClaimable();
  }, [provider, account, loadClaimable]);

  useEffect(() => {
    return () => {
      void disconnectPolkadot();
    };
  }, [disconnectPolkadot]);

  return (
    <div className="container">
      <header className="header">
        <div className="title">心愿簿 WishBook</div>
        <div className="subtitle">把愿望写进链上，也可以收到捐助</div>
      </header>

      <section className="panel">
        <div className="row">
          <button className="btn" onClick={connectWallet}>
            {account ? "已连接" : "连接钱包"}
          </button>
          <div className="meta">
            <div>账号：{account ?? "-"}</div>
            <div>ChainId：{chainId ?? "-"}</div>
            <div>余额：{balance ? `${balance} ETH` : "-"}</div>
            <div>可提现：{claimableEth ? `${claimableEth} ETH` : "-"}</div>
          </div>
        </div>

        <div className="row">
          <label className="label">合约地址</label>
          <input
            className="input"
            value={contractAddress ?? ""}
            placeholder="0x..."
            onChange={(e) => {
              const value = e.target.value.trim();
              const next = value ? value : null;
              setContractAddress(next);
              if (next) setStoredContractAddress(next);
            }}
          />
          <button className="btn" onClick={withdraw} disabled={withdrawing}>
            {withdrawing ? "提现中..." : "提现"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <label className="label">写心愿</label>
        </div>
        <textarea
          className="textarea"
          value={message}
          placeholder="写下你的一个心愿……"
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
        />
        <div className="row actions">
          <button className="btn primary" onClick={postWish} disabled={posting}>
            {posting ? "提交中..." : "上链保存"}
          </button>
          <button className="btn" onClick={() => loadWishes({ offset: 0, limit: 50 })} disabled={loading}>
            {loading ? "刷新中..." : "刷新列表"}
          </button>
        </div>

        {errorText ? <div className="error">{errorText}</div> : null}
      </section>

      <section className="panel">
        <div className="row">
          <div className="label">Polkadot.js</div>
          <div className="hint">连接 Substrate WSS 查询链信息</div>
        </div>

        <div className="row">
          <label className="label">WSS</label>
          <input
            className="input"
            value={polkadotRpc}
            placeholder="wss://rpc.polkadot.io"
            onChange={(e) => setPolkadotRpc(e.target.value)}
          />
          {polkadotConnected ? (
            <button className="btn" onClick={() => void disconnectPolkadot()} disabled={polkadotConnecting}>
              断开
            </button>
          ) : (
            <button className="btn" onClick={() => void connectPolkadot()} disabled={polkadotConnecting}>
              {polkadotConnecting ? "连接中..." : "连接"}
            </button>
          )}
        </div>

        {polkadotInfo ? (
          <div className="meta" style={{ marginTop: 8 }}>
            <div>Chain：{polkadotInfo.chain}</div>
            <div>Node：{polkadotInfo.node}</div>
            <div>Version：{polkadotInfo.version}</div>
            <div>Spec：{polkadotInfo.specName}</div>
            <div>Finalized：{polkadotFinalized ?? "-"}</div>
          </div>
        ) : null}

        {polkadotError ? <div className="error">{polkadotError}</div> : null}
      </section>

      <section className="panel">
        <div className="row">
          <div className="label">最新心愿</div>
          <div className="hint">倒序显示，最多 50 条</div>
        </div>

        <div className="list">
          {wishes.length === 0 ? <div className="empty">暂无内容</div> : null}
          {wishes.map((w) => (
            <div className="card" key={w.id.toString()}>
              <div className="cardMeta">
                <span className="mono">{w.author}</span>
                <span className="mono">{new Date(Number(w.createdAt) * 1000).toLocaleString()}</span>
              </div>
              <div className="cardBody">{w.message}</div>
              <div className="row actions">
                <input
                  className="input"
                  value={donationEth}
                  onChange={(e) => setDonationEth(e.target.value)}
                  placeholder="0.01"
                />
                <button
                  className="btn"
                  onClick={() => donateToWish(w.id)}
                  disabled={donatingId === w.id}
                  title="捐款会记入作者可提现余额"
                >
                  {donatingId === w.id ? "捐款中..." : "捐款"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
