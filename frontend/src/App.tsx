import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, formatEther, parseEther, type Eip1193Provider } from "ethers";
import { getContractAddress, WISHBOOK_ABI } from "./contract";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

type EthereumProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

type WishEntry = {
  id: bigint;
  author: string;
  createdAt: bigint;
  message: string;
};

type WishPayload = {
  authorName: string;
  content: string;
};

type EvmChain = {
  label: string;
  chainIdHex: `0x${string}`;
  chainIdDec: string;
  nativeSymbol: string;
  rpcUrls: string[];
  blockExplorerUrls: string[];
};

const EVM_CHAINS: EvmChain[] = [
  {
    label: "Polkadot Hub TestNet",
    chainIdHex: "0x190f1b41",
    chainIdDec: "420420417",
    nativeSymbol: "PAS",
    rpcUrls: ["https://services.polkadothub-rpc.com/testnet/"],
    blockExplorerUrls: ["https://blockscout-testnet.polkadot.io/"]
  },
  {
    label: "Polkadot Hub",
    chainIdHex: "0x190f1b43",
    chainIdDec: "420420419",
    nativeSymbol: "DOT",
    rpcUrls: ["https://services.polkadothub-rpc.com/mainnet/"],
    blockExplorerUrls: ["https://blockscout.polkadot.io/"]
  },
  {
    label: "Kusama Hub",
    chainIdHex: "0x190f1b42",
    chainIdDec: "420420418",
    nativeSymbol: "KSM",
    rpcUrls: ["https://eth-rpc-kusama.polkadot.io/"],
    blockExplorerUrls: ["https://blockscout-kusama.polkadot.io/"]
  }
];

function getStoredContractAddress(chainIdHex: string | null): string | null {
  if (chainIdHex) {
    const scopedKey = `wishbook_address:${chainIdHex}`;
    const scopedValue = localStorage.getItem(scopedKey);
    if (scopedValue?.trim()) return scopedValue.trim();
  }
  const legacyKey = "wishbook_address";
  const legacyValue = localStorage.getItem(legacyKey);
  return legacyValue?.trim() ? legacyValue.trim() : null;
}

function setStoredContractAddress(address: string, chainIdHex: string | null) {
  if (chainIdHex) {
    const scopedKey = `wishbook_address:${chainIdHex}`;
    localStorage.setItem(scopedKey, address.trim());
  }
  const legacyKey = "wishbook_address";
  localStorage.setItem(legacyKey, address.trim());
}

function encodeWishPayload(payload: WishPayload): string {
  return JSON.stringify(payload);
}

function decodeWishPayload(raw: string): WishPayload {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || !parsed) return { authorName: "", content: raw };
    const record = parsed as Record<string, unknown>;
    const authorName = typeof record["authorName"] === "string" ? record["authorName"] : "";
    const content = typeof record["content"] === "string" ? record["content"] : raw;
    return { authorName, content };
  } catch {
    return { authorName: "", content: raw };
  }
}

function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
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

const WISHES_PAGE_SIZE = 50;

export default function App() {
  const [selectedEvmChainHex, setSelectedEvmChainHex] = useState<string>(() => {
    const saved = localStorage.getItem("wishbook_evm_chain");
    return saved?.trim() ? saved.trim() : EVM_CHAINS[0].chainIdHex;
  });
  const [contractAddress, setContractAddress] = useState<string | null>(
    () => getStoredContractAddress(selectedEvmChainHex) ?? getContractAddress()
  );
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);

  const [wishAuthorName, setWishAuthorName] = useState("");
  const [wishContent, setWishContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [donatingId, setDonatingId] = useState<bigint | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [wishes, setWishes] = useState<WishEntry[]>([]);
  const [loadingMoreWishes, setLoadingMoreWishes] = useState(false);
  const [wishesHasMore, setWishesHasMore] = useState(false);

  const contractRead = useMemo(() => {
    if (!provider || !contractAddress) return null;
    return new Contract(contractAddress, WISHBOOK_ABI, provider);
  }, [provider, contractAddress]);

  const selectedEvmChain = useMemo(() => {
    return EVM_CHAINS.find((c) => c.chainIdHex === selectedEvmChainHex) ?? EVM_CHAINS[0];
  }, [selectedEvmChainHex]);

  const connectedEvmChain = useMemo(() => {
    if (!chainId) return null;
    return EVM_CHAINS.find((c) => c.chainIdDec === chainId) ?? null;
  }, [chainId]);

  const displayEvmChain = connectedEvmChain ?? selectedEvmChain;
  const isChainMismatch =
    Boolean(chainId) && (!connectedEvmChain || connectedEvmChain.chainIdHex !== selectedEvmChain.chainIdHex);

  const syncWalletState = useCallback(
    async (nextProvider: BrowserProvider, address: string) => {
      const network = await nextProvider.getNetwork();
      const bal = await nextProvider.getBalance(address);

      setProvider(nextProvider);
      setAccount(address);
      setChainId(network.chainId.toString());
      setBalance(formatEther(bal));

      const matched = EVM_CHAINS.find((c) => c.chainIdDec === network.chainId.toString());
      if (matched) {
        setSelectedEvmChainHex(matched.chainIdHex);
        localStorage.setItem("wishbook_evm_chain", matched.chainIdHex);
      }
    },
    []
  );

  const ensureEvmChain = useCallback(
    async (target: EvmChain) => {
      const eth = window.ethereum as EthereumProvider | undefined;
      if (!eth) {
        setErrorText("No wallet extension detected (MetaMask, etc.).");
        return;
      }
      setErrorText(null);
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: target.chainIdHex }]
        });
      } catch (e: unknown) {
        const record = e as Record<string, unknown>;
        const code = record["code"];
        const message = typeof record["message"] === "string" ? record["message"] : "";
        const missingChain = code === 4902 || message.includes("Unrecognized chain ID") || message.includes("not added");
        if (!missingChain) throw e;

        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: target.chainIdHex,
              chainName: target.label,
              nativeCurrency: { name: target.nativeSymbol, symbol: target.nativeSymbol, decimals: 18 },
              rpcUrls: target.rpcUrls,
              blockExplorerUrls: target.blockExplorerUrls
            }
          ]
        });
      }
    },
    []
  );

  const connectWallet = useCallback(async () => {
    setErrorText(null);
    const eth = window.ethereum as EthereumProvider | undefined;
    if (!eth) {
      setErrorText("No wallet extension detected (MetaMask, etc.).");
      return;
    }

    try {
      await ensureEvmChain(selectedEvmChain);
    } catch (err: unknown) {
      setErrorText(toErrorText(err));
      return;
    }

    const nextProvider = new BrowserProvider(eth);
    const accounts: string[] = await nextProvider.send("eth_requestAccounts", []);
    const address = accounts[0];
    if (!address) {
      setErrorText("No account returned from wallet.");
      return;
    }

    await syncWalletState(nextProvider, address);
  }, [ensureEvmChain, selectedEvmChain, syncWalletState]);

  const loadWishes = useCallback(
    async (opts?: { offset?: number; limit?: number }) => {
      if (!contractRead) return;
      setErrorText(null);
      setLoading(true);
      try {
        const offset = BigInt(opts?.offset ?? 0);
        const limitNumber = opts?.limit ?? WISHES_PAGE_SIZE;
        const limit = BigInt(limitNumber);
        const page: WishEntry[] = await contractRead.getWishes(offset, limit);
        setWishes(page);
        setWishesHasMore(page.length === limitNumber);
      } catch (e: unknown) {
        setErrorText(toErrorText(e));
      } finally {
        setLoading(false);
      }
    },
    [contractRead]
  );

  const loadMoreWishes = useCallback(async () => {
    if (!contractRead) return;
    if (loadingMoreWishes) return;
    if (!wishesHasMore && wishes.length > 0) return;

    setErrorText(null);
    setLoadingMoreWishes(true);
    try {
      const offset = BigInt(wishes.length);
      const limit = BigInt(WISHES_PAGE_SIZE);
      const page: WishEntry[] = await contractRead.getWishes(offset, limit);
      setWishes((prev) => [...prev, ...page]);
      setWishesHasMore(page.length === WISHES_PAGE_SIZE);
    } catch (e: unknown) {
      setErrorText(toErrorText(e));
    } finally {
      setLoadingMoreWishes(false);
    }
  }, [contractRead, loadingMoreWishes, wishes.length, wishesHasMore]);

  const postWish = useCallback(async () => {
    if (!provider || !account) {
      setErrorText("Please connect your wallet first.");
      return;
    }
    if (!contractAddress) {
      setErrorText("Please enter the contract address first.");
      return;
    }
    if (!wishContent.trim()) {
      setErrorText("Content cannot be empty.");
      return;
    }

    setErrorText(null);
    setPosting(true);
    try {
      const payload = encodeWishPayload({ authorName: wishAuthorName.trim(), content: wishContent.trim() });
      if (utf8ByteLength(payload) > 2000) {
        setErrorText("Content is too long (must be <= 2000 bytes).");
        return;
      }
      const signer = await provider.getSigner();
      const contractWrite = new Contract(contractAddress, WISHBOOK_ABI, signer);
      const tx = await contractWrite.writeWish(payload);
      await tx.wait();
      setWishAuthorName("");
      setWishContent("");
      await loadWishes({ offset: 0, limit: WISHES_PAGE_SIZE });
    } catch (e: unknown) {
      setErrorText(toErrorText(e));
    } finally {
      setPosting(false);
    }
  }, [provider, account, contractAddress, wishAuthorName, wishContent, loadWishes]);

  const donateToWish = useCallback(
    async (id: bigint, donationAmount: string) => {
      if (!provider || !account) {
        setErrorText("Please connect your wallet first.");
        return;
      }
      if (!contractAddress) {
        setErrorText("Please enter the contract address first.");
        return;
      }

      setErrorText(null);
      setDonatingId(id);
      try {
        const amount = parseEther(donationAmount || "0");
        if (amount <= 0n) {
          setErrorText("Donation amount must be greater than 0.");
          return;
        }
        const signer = await provider.getSigner();
        const contractWrite = new Contract(contractAddress, WISHBOOK_ABI, signer);
        const tx = await contractWrite.donate(id, { value: amount });
        await tx.wait();
      } catch (e: unknown) {
        setErrorText(toErrorText(e));
      } finally {
        setDonatingId(null);
      }
    },
    [provider, account, contractAddress]
  );

  useEffect(() => {
    if (!provider) return;
    void loadWishes({ offset: 0, limit: WISHES_PAGE_SIZE });
  }, [provider, loadWishes]);

  useEffect(() => {
    const address = getStoredContractAddress(selectedEvmChainHex);
    const envAddress = getContractAddress();
    setContractAddress(address ?? envAddress);
  }, [selectedEvmChainHex]);

  useEffect(() => {
    const eth = window.ethereum as EthereumProvider | undefined;
    if (!eth) return;

    const onAccountsChanged = (accounts: unknown) => {
      const list = Array.isArray(accounts) ? (accounts as string[]) : [];
      const next = list[0]?.trim();
      if (!next) {
        setProvider(null);
        setAccount(null);
        setChainId(null);
        setBalance(null);
        return;
      }
      const nextProvider = new BrowserProvider(eth);
      void syncWalletState(nextProvider, next);
    };

    const onChainChanged = () => {
      if (!account) return;
      const nextProvider = new BrowserProvider(eth);
      void syncWalletState(nextProvider, account);
    };

    eth.on?.("accountsChanged", onAccountsChanged);
    eth.on?.("chainChanged", onChainChanged);
    return () => {
      eth.removeListener?.("accountsChanged", onAccountsChanged);
      eth.removeListener?.("chainChanged", onChainChanged);
    };
  }, [account, syncWalletState]);

  return (
    <div className="container">
      <header className="header">
        <div className="title">WishBook</div>
      </header>

      <section className="panel">
        <div className="row">
          <button className="btn" onClick={connectWallet}>
            {account ? "Connected" : "Connect Wallet"}
          </button>
          <div className="meta">
            <div>Account: {account ?? "-"}</div>
            <div>Network: {connectedEvmChain ? connectedEvmChain.label : chainId ? `Unknown network (${chainId})` : "-"}</div>
            <div>Selected: {selectedEvmChain.label}</div>
            <div>ChainId：{chainId ?? "-"}</div>
            <div>Balance: {balance ? `${balance} ${displayEvmChain.nativeSymbol}` : "-"}</div>
          </div>
        </div>

        <div className="row">
          <label className="label">EVM Network</label>
          <select
            className="input"
            value={selectedEvmChainHex}
            onChange={async (e) => {
              const nextHex = e.target.value;
              const next = EVM_CHAINS.find((c) => c.chainIdHex === nextHex);
              if (!next) return;
              setSelectedEvmChainHex(next.chainIdHex);
              localStorage.setItem("wishbook_evm_chain", next.chainIdHex);
              try {
                await ensureEvmChain(next);
                if (account) {
                  const eth = window.ethereum as EthereumProvider | undefined;
                  if (eth) {
                    const nextProvider = new BrowserProvider(eth);
                    await syncWalletState(nextProvider, account);
                  }
                }
              } catch (err: unknown) {
                setErrorText(toErrorText(err));
              }
            }}
          >
            {EVM_CHAINS.map((c) => (
              <option key={c.chainIdHex} value={c.chainIdHex}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {isChainMismatch ? (
          <div className="error">Wallet network doesn't match selected network. Please switch using the dropdown.</div>
        ) : null}

        <div className="row">
          <label className="label">Contract Address</label>
          <input
            className="input"
            value={contractAddress ?? ""}
            placeholder="0x..."
            onChange={(e) => {
              const value = e.target.value.trim();
              const next = value ? value : null;
              setContractAddress(next);
              if (next) setStoredContractAddress(next, selectedEvmChainHex);
            }}
          />
          <button
            className="btn"
            onClick={() => {
              const idInput = window.prompt("Wish ID", wishes[0]?.id.toString() ?? "");
              if (!idInput) return;
              const amount = window.prompt("Donation amount", "0.01");
              if (!amount) return;
              try {
                const wishId = BigInt(idInput.trim());
                void donateToWish(wishId, amount.trim());
              } catch {
                setErrorText("Invalid Wish ID format.");
              }
            }}
            disabled={donatingId !== null}
            title="Donate to a specific wish"
          >
            {donatingId !== null ? "Donating..." : "Donate"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="row">
          <label className="label">Write a Wish</label>
        </div>
        <div className="row">
          <input
            className="input"
            value={wishAuthorName}
            placeholder="Sign (optional)"
            onChange={(e) => setWishAuthorName(e.target.value)}
          />
        </div>
        <textarea
          className="textarea"
          value={wishContent}
          placeholder="Write your wish..."
          onChange={(e) => setWishContent(e.target.value)}
          rows={5}
        />
        <div className="row actions">
          <button className="btn primary" onClick={postWish} disabled={posting}>
            {posting ? "Submitting..." : "Submit on-chain"}
          </button>
        </div>

        {errorText ? <div className="error">{errorText}</div> : null}
      </section>

      {/* <section className="panel">
        <div className="row">
          <div className="label">Polkadot.js</div>
          <div className="hint">Connect to Substrate WSS to inspect chain info</div>
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
              Disconnect
            </button>
          ) : (
            <button className="btn" onClick={() => void connectPolkadot()} disabled={polkadotConnecting}>
              {polkadotConnecting ? "Connecting..." : "Connect"}
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
      </section> */}

      <section className="panel">
        <div className="row">
          <div className="label">Latest Wishes</div>
          <button
            className="btn"
            style={{ marginLeft: "auto" }}
            onClick={loadMoreWishes}
            disabled={!contractRead || loading || loadingMoreWishes || (wishes.length > 0 && !wishesHasMore)}
          >
            {loadingMoreWishes ? "Loading..." : "More"}
          </button>
        </div>

        <div className="list">
          {wishes.length === 0 ? <div className="empty">No content yet.</div> : null}
          {wishes.map((w) => {
            const payload = decodeWishPayload(w.message);
            return (
              <div className="card" key={w.id.toString()}>
                <div className="cardMeta">
                  <span className="mono">{w.author}</span>
                  <span className="mono">{new Date(Number(w.createdAt) * 1000).toLocaleString()}</span>
                </div>
                <div className="cardBody">
                  <div>
                    {payload.content} — {payload.authorName ? payload.authorName : "Anonymous"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
