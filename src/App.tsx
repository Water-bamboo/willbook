import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther, type Eip1193Provider } from "ethers";
import { getContractAddress, WILLBOOK_ABI } from "./contract";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type WillEntry = {
  author: string;
  createdAt: bigint;
  message: string;
};

function getStoredContractAddress(): string | null {
  const key = "willbook_address";
  const value = localStorage.getItem(key);
  return value?.trim() ? value.trim() : null;
}

function setStoredContractAddress(address: string) {
  const key = "willbook_address";
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

  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [wills, setWills] = useState<WillEntry[]>([]);

  const contractRead = useMemo(() => {
    if (!provider || !contractAddress) return null;
    return new Contract(contractAddress, WILLBOOK_ABI, provider);
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

  const loadWills = useCallback(
    async (opts?: { offset?: number; limit?: number }) => {
      if (!contractRead) return;
      setErrorText(null);
      setLoading(true);
      try {
        const offset = BigInt(opts?.offset ?? 0);
        const limit = BigInt(opts?.limit ?? 50);
        const page: WillEntry[] = await contractRead.getWills(offset, limit);
        setWills(page);
      } catch (e: unknown) {
        setErrorText(toErrorText(e));
      } finally {
        setLoading(false);
      }
    },
    [contractRead]
  );

  const postWill = useCallback(async () => {
    if (!provider || !account) {
      setErrorText("请先连接钱包。");
      return;
    }
    if (!contractAddress) {
      setErrorText("请先填写合约地址。");
      return;
    }
    if (!message.trim()) {
      setErrorText("遗言不能为空。");
      return;
    }

    setErrorText(null);
    setPosting(true);
    try {
      const signer = await provider.getSigner();
      const contractWrite = new Contract(contractAddress, WILLBOOK_ABI, signer);
      const tx = await contractWrite.writeWill(message.trim());
      await tx.wait();
      setMessage("");
      await loadWills({ offset: 0, limit: 50 });
    } catch (e: unknown) {
      setErrorText(toErrorText(e));
    } finally {
      setPosting(false);
    }
  }, [provider, account, contractAddress, message, loadWills]);

  useEffect(() => {
    if (!provider) return;
    void loadWills({ offset: 0, limit: 50 });
  }, [provider, loadWills]);

  return (
    <div className="container">
      <header className="header">
        <div className="title">遗言簿 WillBook</div>
        <div className="subtitle">把想说的话写进链上</div>
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
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <label className="label">写遗言</label>
        </div>
        <textarea
          className="textarea"
          value={message}
          placeholder="写下你想留给世界的话……"
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
        />
        <div className="row actions">
          <button className="btn primary" onClick={postWill} disabled={posting}>
            {posting ? "提交中..." : "上链保存"}
          </button>
          <button className="btn" onClick={() => loadWills({ offset: 0, limit: 50 })} disabled={loading}>
            {loading ? "刷新中..." : "刷新列表"}
          </button>
        </div>

        {errorText ? <div className="error">{errorText}</div> : null}
      </section>

      <section className="panel">
        <div className="row">
          <div className="label">最新遗言</div>
          <div className="hint">倒序显示，最多 50 条</div>
        </div>

        <div className="list">
          {wills.length === 0 ? <div className="empty">暂无内容</div> : null}
          {wills.map((w, idx) => (
            <div className="card" key={`${w.author}-${w.createdAt.toString()}-${idx}`}>
              <div className="cardMeta">
                <span className="mono">{w.author}</span>
                <span className="mono">{new Date(Number(w.createdAt) * 1000).toLocaleString()}</span>
              </div>
              <div className="cardBody">{w.message}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
