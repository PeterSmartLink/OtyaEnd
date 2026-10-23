"use client";

import { useMemo, useState } from "react";

type Tab = "home" | "sell" | "stock" | "agent" | "cash";
type Product = { id: number; name: string; sku: string; price: number; stock: number };
type Draft = { id: string; kind: string; provider: string; phone: string; amount: number };

const initialProducts: Product[] = [
  { id: 1, name: "USB-C Fast Charger", sku: "ACC-1042", price: 25000, stock: 18 },
  { id: 2, name: "Wireless Earbuds", sku: "AUD-2081", price: 45000, stock: 7 },
  { id: 3, name: "Smartphone Case", sku: "ACC-1033", price: 12000, stock: 32 },
  { id: 4, name: "Power Bank 20,000mAh", sku: "PWR-3014", price: 65000, stock: 4 },
  { id: 5, name: "USB-C Cable", sku: "ACC-1077", price: 10000, stock: 21 },
  { id: 6, name: "Bluetooth Speaker", sku: "AUD-2044", price: 85000, stock: 5 },
];
const money = (n: number) => "UGX " + n.toLocaleString("en-UG");
const nav: { id: Tab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "sell", label: "Sell", icon: "🛒" },
  { id: "stock", label: "Stock", icon: "▦" },
  { id: "agent", label: "Agent", icon: "↔" },
  { id: "cash", label: "Cashbook", icon: "▤" },
];

export default function OmniPointPage() {
  const [tab, setTab] = useState<Tab>("home");
  const [products, setProducts] = useState(initialProducts);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("Cash-in");
  const [provider, setProvider] = useState("MTN MoMo");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");

  const visibleProducts = useMemo(
    () => products.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(query.toLowerCase())),
    [products, query],
  );
  const cartProducts = products.filter((p) => (cart[p.id] || 0) > 0);
  const total = cartProducts.reduce((sum, p) => sum + p.price * cart[p.id], 0);
  const titles: Record<Tab, [string, string]> = {
    home: ["Your business at a glance", "A simple workspace for the counter."],
    sell: ["Retail point of sale", "Tap products to try a sample sale."],
    stock: ["Inventory", "Find products and review sample stock."],
    agent: ["Agency service", "Prepare a local-only transaction draft."],
    cash: ["Cashbook", "Review drafts saved in this browser session."],
  };

  function changeTab(next: Tab) {
    setTab(next);
    setMessage("");
  }
  function addToCart(id: number) {
    const product = products.find((p) => p.id === id);
    if (!product || (cart[id] || 0) >= product.stock) return;
    setCart((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
  }
  function completeSampleSale() {
    if (!cartProducts.length) {
      setMessage("Add a sample product to the cart first.");
      return;
    }
    setProducts((current) => current.map((p) => ({ ...p, stock: p.stock - (cart[p.id] || 0) })));
    setCart({});
    setMessage("Sample sale completed in this browser only. No money moved and no real sale was recorded.");
  }
  function saveDraft() {
    const parsedAmount = Number(amount);
    const digits = phone.replace(/\D/g, "");
    if (!(parsedAmount > 0)) {
      setMessage("Enter an amount greater than zero.");
      return;
    }
    if (digits.length < 9 || digits.length > 15) {
      setMessage("Enter a test phone number with 9–15 digits.");
      return;
    }
    setDrafts((current) => [{
      id: "DEMO-" + String(current.length + 1).padStart(4, "0"),
      kind, provider, phone: phone.trim(), amount: parsedAmount,
    }, ...current]);
    setAmount("");
    setPhone("");
    setMessage("Local draft saved. No provider was contacted and no money moved.");
  }

  return (
    <main className="op-shell">
      <header className="op-top">
        <div className="op-brand"><span className="op-logo">O</span><div><strong>OmniPoint</strong><small>BUSINESS WORKSPACE</small></div></div>
        <span className="op-pill">PREVIEW MODE</span>
      </header>
      <div className="op-content">
        <div className="op-heading"><div><div className="op-eyebrow">UGANDA · UGX</div><h1>{titles[tab][0]}</h1><p>{titles[tab][1]}</p></div></div>
        <div className="op-notice"><strong>Safe preview — sample data only.</strong><br />No live business records, payment providers, or production database are connected. Actions here do not move money.</div>
        {message && <div className="op-message" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}

        {tab === "home" && <>
          <div className="op-grid">
            <article className="op-card"><span>Sample retail sales</span><b className="op-metric">UGX 385,000</b><small>Illustrative figure · not live</small></article>
            <article className="op-card"><span>Sample stock items</span><b className="op-metric">{products.length}</b><small>Products in this browser</small></article>
            <article className="op-card"><span>Agency drafts</span><b className="op-metric">{drafts.length}</b><small>Not sent to a provider</small></article>
            <article className="op-card"><span>Business status</span><b className="op-status">Preview only</b><small>Real operations disabled</small></article>
          </div>
          <section className="op-card op-section"><h2>Quick actions</h2><p>Choose what you want to do.</p><div className="op-actions">
            <button onClick={() => changeTab("sell")}><strong>🛒 Sell a product</strong><small>Try a sample sale</small></button>
            <button onClick={() => changeTab("stock")}><strong>📦 Check stock</strong><small>View sample inventory</small></button>
            <button onClick={() => changeTab("agent")}><strong>📱 Agency service</strong><small>Save a local draft</small></button>
            <button onClick={() => changeTab("cash")}><strong>📒 Cashbook</strong><small>View draft activity</small></button>
          </div></section>
          <section className="op-card op-section"><h2>Items to review</h2><p>Sample low-stock products</p>{products.filter((p) => p.stock <= 7).map((p) => <div className="op-row" key={p.id}><div><strong>{p.name}</strong><small>{p.sku}</small></div><span className="op-badge">{p.stock} left</span></div>)}</section>
        </>}

        {tab === "sell" && <section className="op-split">
          <div className="op-card"><h2>Choose products</h2><p>Tap an item to add it to your sample cart.</p><div className="op-products">{products.map((p) => <button className="op-product" key={p.id} disabled={p.stock <= (cart[p.id] || 0)} onClick={() => addToCart(p.id)}><strong>{p.name}</strong><small>{p.sku} · {p.stock} in sample stock</small><b>{money(p.price)}</b></button>)}</div></div>
          <div className="op-card"><h2>Current sale</h2>{cartProducts.length ? cartProducts.map((p) => <div className="op-row" key={p.id}><div><strong>{p.name}</strong><small>{cart[p.id]} × {money(p.price)}</small></div><button className="op-secondary" onClick={() => setCart((c) => ({ ...c, [p.id]: Math.max(0, (c[p.id] || 0) - 1) }))}>−</button><b>{money(p.price * cart[p.id])}</b></div>) : <div className="op-empty">Your cart is empty. Add a sample product.</div>}<div className="op-total"><strong>Demo total</strong><b>{money(total)}</b></div><button className="op-primary" onClick={completeSampleSale}>Complete sample sale</button><small className="op-foot">This only changes sample stock in your browser. No real sale or ledger entry is created.</small></div>
        </section>}

        {tab === "stock" && <section className="op-card"><h2>Stock list</h2><p>Search and review sample products.</p><input className="op-field" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search product or SKU" />{visibleProducts.map((p) => <div className="op-row" key={p.id}><div><strong>{p.name}</strong><small>{p.sku} · {money(p.price)}</small></div><span className={p.stock <= 7 ? "op-badge" : "op-muted"}>{p.stock} left</span></div>)}{!visibleProducts.length && <div className="op-empty">No matching products.</div>}</section>}

        {tab === "agent" && <section className="op-split"><div className="op-card"><h2>Mobile-money agent desk</h2><p>Prepare a local draft only. No provider request is made.</p><label>Service<select className="op-field" value={kind} onChange={(e) => setKind(e.target.value)}><option>Cash-in</option><option>Cash-out</option><option>Airtime & data</option><option>Bill payment</option></select></label><label>Provider<select className="op-field" value={provider} onChange={(e) => setProvider(e.target.value)}><option>MTN MoMo</option><option>Airtel Money</option><option>Cashbook only</option></select></label><label>Customer phone (test value only)<input className="op-field" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Enter test phone number" /></label><label>Amount (UGX)<input className="op-field" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="Enter amount" /></label><button className="op-primary" onClick={saveDraft}>Save local draft</button><small className="op-foot">Never ask for a customer PIN or OTP. This preview does not process money.</small></div><div className="op-card"><h2>Recent drafts</h2>{drafts.length ? drafts.map((d) => <div className="op-row" key={d.id}><div><strong>{d.kind} · {d.provider}</strong><small>{d.id} · {d.phone}</small></div><div className="op-right"><b>{money(d.amount)}</b><small className="op-badge">LOCAL DRAFT</small></div></div>) : <div className="op-empty">No drafts yet.</div>}</div></section>}

        {tab === "cash" && <section className="op-card"><h2>Cashbook activity</h2><p>Local drafts from this browser session.</p>{drafts.length ? drafts.map((d) => <div className="op-row" key={d.id}><div><strong>{d.kind} · {d.provider}</strong><small>{d.id} · {d.phone}</small></div><div className="op-right"><b>{money(d.amount)}</b><small className="op-badge">LOCAL DRAFT</small></div></div>) : <div className="op-empty">No drafts yet. Save a draft from the Agent tab.</div>}</section>}
        <footer className="op-footer">OmniPoint · Mobile-first operations preview · Not for live transactions</footer>
      </div>
      <nav className="op-nav" aria-label="Main navigation">{nav.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => changeTab(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <style jsx global>{`
        *{box-sizing:border-box}body{margin:0;background:#0b1220;color:#f1f5ff;font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}.op-shell{min-height:100dvh;padding-bottom:80px;background:radial-gradient(ellipse at 80% 0,#1b3150 0,transparent 38%),#0b1220}.op-top{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #293b55;position:sticky;top:0;background:#0b1220f2;backdrop-filter:blur(12px);z-index:3}.op-brand{display:flex;align-items:center;gap:10px}.op-logo{display:grid;place-items:center;width:40px;height:40px;border-radius:13px;background:linear-gradient(135deg,#86aaff,#77e0b7);color:#0b1220;font-weight:900;font-size:21px}.op-brand strong{display:block;font-size:19px;letter-spacing:-.5px}.op-brand small{display:block;color:#93a5be;font-size:10px;letter-spacing:1px}.op-pill{border:1px solid #66522b;background:#332817;color:#ffd18a;font-size:10px;font-weight:800;padding:7px 9px;border-radius:20px}.op-content{padding:20px 14px;max-width:940px;margin:auto}.op-heading{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:18px}.op-eyebrow{font-size:10px;letter-spacing:1.5px;color:#93a5be;font-weight:800}.op-heading h1{font-size:clamp(24px,5vw,32px);line-height:1.2;margin:5px 0}.op-heading p,.op-card p{margin:4px 0;color:#93a5be}.op-notice{border:1px solid #66522b;background:#241f17;color:#ffd18a;border-radius:12px;padding:12px 14px;font-size:12px;margin-bottom:16px}.op-message{display:flex;justify-content:space-between;gap:12px;background:#21314a;border:1px solid #405c83;color:#dce8ff;border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px}.op-message button{border:0;background:transparent;color:inherit;font-size:20px}.op-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.op-card{background:linear-gradient(150deg,#14233a,#101b2c);border:1px solid #293b55;border-radius:15px;padding:15px;min-width:0}.op-card h2{font-size:16px;margin:0 0 5px}.op-card>span,.op-card>.op-metric{display:block}.op-card>span{font-size:12px;color:#93a5be}.op-metric{font-size:23px;font-weight:800;margin:8px 0 2px}.op-card>small{font-size:11px;color:#93a5be}.op-status{display:block;font-size:18px;color:#77e0b7;margin:10px 0 5px}.op-section{margin-top:14px}.op-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.op-actions button,.op-product{background:#101d30;border:1px solid #293b55;color:#f1f5ff;border-radius:12px;padding:13px;text-align:left;min-height:64px}.op-actions strong,.op-product strong{display:block;font-size:13px}.op-actions small,.op-product small{display:block;color:#93a5be;font-size:11px;margin-top:3px}.op-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.op-product b{display:block;color:#a9c3ff;font-size:12px;margin-top:8px}.op-product:disabled{opacity:.45}.op-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #293b55}.op-row>div:first-child{flex:1;min-width:0}.op-row strong,.op-row b{font-size:12px;display:block}.op-row small{color:#93a5be;font-size:10px;display:block;margin-top:3px}.op-badge{font-size:10px;border-radius:7px;padding:5px 7px;background:#3b2d19;color:#ffd18a;white-space:nowrap}.op-muted{color:#93a5be;font-size:11px}.op-split{display:grid;gap:12px}.op-field{display:block;width:100%;padding:12px;border:1px solid #293b55;background:#0d192b;border-radius:10px;color:#f1f5ff;margin:7px 0 13px}.op-primary{width:100%;padding:13px;border:0;border-radius:10px;background:linear-gradient(100deg,#8aaaff,#77e0b7);color:#0b1220;font-weight:850;cursor:pointer}.op-secondary{padding:8px 11px;border:1px solid #293b55;background:#14233a;color:#f1f5ff;border-radius:9px}.op-total{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #293b55;padding:14px 0;margin-top:8px}.op-total b{font-size:18px}.op-empty{padding:22px 6px;text-align:center;color:#93a5be;font-size:12px}.op-foot{display:block;margin-top:12px;line-height:1.6}.op-right{text-align:right}.op-footer{text-align:center;font-size:10px;color:#71839d;padding:24px 0}.op-nav{position:fixed;z-index:5;bottom:0;left:0;right:0;display:flex;justify-content:center;gap:4px;padding:8px 6px calc(8px + env(safe-area-inset-bottom));background:#0d1728f5;border-top:1px solid #293b55;backdrop-filter:blur(14px)}.op-nav button{flex:1;max-width:150px;min-height:52px;border:0;border-radius:10px;background:transparent;color:#93a5be;font-size:10px;font-weight:700}.op-nav button span{display:block;font-size:19px;line-height:1.1;margin-bottom:4px}.op-nav button.active{background:#203453;color:#a9c3ff}@media(min-width:760px){.op-shell{padding-bottom:0}.op-top{padding:18px 28px}.op-content{padding:28px}.op-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.op-actions{grid-template-columns:repeat(4,minmax(0,1fr))}.op-split{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr)}.op-nav{position:static;border:1px solid #293b55;border-radius:14px;margin:18px auto 0;max-width:940px}}@media(max-width:360px){.op-content{padding:15px 10px}.op-card{padding:12px}.op-pill{font-size:9px}}
      `}</style>
    </main>
  );
}
