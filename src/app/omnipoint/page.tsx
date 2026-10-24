"use client";

import { useCallback, useEffect, useState } from "react";

type Product = {
  id: string; sku: string; name: string; description: string | null; category: string;
  cost_price: number; selling_price: number; quantity_on_hand: number; reorder_level: number;
};
type Summary = { products: number; completedSales: number; retailSalesTotal: number; agencyTransactions: number; successfulAgencyVolume: number; ledgerEntries: number };
type Health = { ok: boolean; schemaReady: boolean; missingTables: string[]; demoData: false };

const money = (n: number) => "UGX " + Number(n || 0).toLocaleString("en-UG");

export default function OmniPointPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ sku: "", name: "", category: "Phones & Accessories", description: "", costPrice: "", sellingPrice: "", quantityOnHand: "0", reorderLevel: "0" });
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [h, s, p] = await Promise.all([
        fetch("/api/omnipoint?resource=health", { cache: "no-store" }),
        fetch("/api/omnipoint?resource=summary", { cache: "no-store" }),
        fetch("/api/omnipoint?resource=products", { cache: "no-store" }),
      ]);
      if (h.status === 401 || s.status === 401 || p.status === 401) throw new Error("Sign in with an authorized administrator account to access OmniPoint.");
      const healthBody = await h.json();
      setHealth(healthBody as Health);
      if (!s.ok || !p.ok || !healthBody.schemaReady) throw new Error("The production OmniPoint schema is not ready yet. No demo data is shown and no business records have been created.");
      const summaryBody = await s.json();
      const productsBody = await p.json();
      setSummary(summaryBody);
      setProducts(Array.isArray(productsBody.products) ? productsBody.products : []);
    } catch (e) {
      setSummary(null); setProducts([]);
      setError(e instanceof Error ? e.message : "Could not load production records.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitProduct(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/omnipoint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "product.create", ...form, costPrice: Number(form.costPrice), sellingPrice: Number(form.sellingPrice), quantityOnHand: Number(form.quantityOnHand), reorderLevel: Number(form.reorderLevel) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save product.");
      setForm({ sku: "", name: "", category: "Phones & Accessories", description: "", costPrice: "", sellingPrice: "", quantityOnHand: "0", reorderLevel: "0" });
      setShowForm(false); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save product."); }
    finally { setBusy(false); }
  }

  async function submitAdjustment(event: React.FormEvent) {
    event.preventDefault(); if (!adjusting) return; setBusy(true); setError("");
    try {
      const response = await fetch("/api/omnipoint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stock.adjust", productId: adjusting.id, quantityDelta: Number(delta), reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not adjust stock.");
      setAdjusting(null); setDelta(""); setReason(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not adjust stock."); }
    finally { setBusy(false); }
  }

  const visible = products.filter(p => (p.name + " " + p.sku + " " + p.category).toLowerCase().includes(query.toLowerCase()));
  const cartLines = products.filter(p => (cart[p.id] || 0) > 0);
  const cartTotal = cartLines.reduce((sum, p) => sum + p.selling_price * cart[p.id], 0);

  async function completeCashSale() {
    if (!cartLines.length) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/omnipoint", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sale.create", paymentMethod: "CASH", items: cartLines.map(p => ({ productId: p.id, quantity: cart[p.id] })) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not record cash sale.");
      setCart({});
      await load();
      window.alert("Sale recorded: " + body.receiptNumber + " · " + money(body.total));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record cash sale."); }
    finally { setBusy(false); }
  }

  return <main className="omni-shell">
    <header className="omni-header">
      <a href="/omnipoint" className="omni-brand"><span className="omni-mark">O</span><span><b>OmniPoint</b><small>BUSINESS OPERATIONS</small></span></a>
      <button className="omni-quiet" onClick={() => void load()} disabled={busy}>Refresh</button>
    </header>
    <div className="omni-content">
      <div className="omni-heading"><div><span className="omni-kicker">UGANDA · UGX</span><h1>Business workspace</h1><p>Retail inventory and agency operations from the connected production database.</p></div><span className="omni-live">PRODUCTION DATA</span></div>
      {error && <section className="omni-alert" role="alert"><b>Live data unavailable</b><p>{error}</p>{health?.missingTables?.length ? <small>Missing schema: {health.missingTables.join(", ")}</small> : null}<button onClick={() => void load()}>Try again</button></section>}
      {summary && <div className="omni-metrics">
        <article><span>Active products</span><b>{summary.products}</b><small>Production inventory</small></article>
        <article><span>Completed retail sales</span><b>{summary.completedSales}</b><small>{money(summary.retailSalesTotal)} total</small></article>
        <article><span>Agency transactions</span><b>{summary.agencyTransactions}</b><small>{money(summary.successfulAgencyVolume)} successful volume</small></article>
        <article><span>Ledger entries</span><b>{summary.ledgerEntries}</b><small>Recorded in production</small></article>
      </div>}
      <section className="omni-panel">
        <div className="omni-panel-head"><div><h2>Inventory</h2><p>Products loaded from Cloudflare D1. No sample catalogue is used.</p></div><button className="omni-primary" onClick={() => setShowForm(v => !v)} disabled={!health?.schemaReady}>{showForm ? "Cancel" : "＋ Add product"}</button></div>
        {showForm && <form className="omni-form" onSubmit={submitProduct}>
          <label>SKU<input required maxLength={80} value={form.sku} onChange={e => setForm({...form,sku:e.target.value})} /></label>
          <label>Product name<input required maxLength={180} value={form.name} onChange={e => setForm({...form,name:e.target.value})} /></label>
          <label>Category<input required maxLength={80} value={form.category} onChange={e => setForm({...form,category:e.target.value})} /></label>
          <label>Description<input maxLength={1000} value={form.description} onChange={e => setForm({...form,description:e.target.value})} /></label>
          <label>Cost price (UGX)<input required type="number" min="0" step="1" value={form.costPrice} onChange={e => setForm({...form,costPrice:e.target.value})} /></label>
          <label>Selling price (UGX)<input required type="number" min="0" step="1" value={form.sellingPrice} onChange={e => setForm({...form,sellingPrice:e.target.value})} /></label>
          <label>Opening stock<input required type="number" min="0" step="1" value={form.quantityOnHand} onChange={e => setForm({...form,quantityOnHand:e.target.value})} /></label>
          <label>Reorder level<input required type="number" min="0" step="1" value={form.reorderLevel} onChange={e => setForm({...form,reorderLevel:e.target.value})} /></label>
          <button className="omni-primary omni-submit" disabled={busy}>{busy ? "Saving…" : "Save product to production"}</button>
        </form>}
        <input className="omni-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search production inventory by name, SKU or category" aria-label="Search inventory" />
        {!summary && !error && <div className="omni-empty">Loading production records…</div>}
        {summary && visible.length === 0 && <div className="omni-empty">{products.length ? "No matching products." : "No products are recorded yet. Add your first real product to start using inventory."}</div>}
        {visible.length > 0 && <div className="omni-table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Cost</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead><tbody>{visible.map(p => <tr key={p.id}><td><b>{p.name}</b><small>{p.category}</small></td><td>{p.sku}</td><td>{money(p.cost_price)}</td><td>{money(p.selling_price)}</td><td><span className={p.quantity_on_hand <= p.reorder_level ? "omni-low" : "omni-stock"}>{p.quantity_on_hand}</span></td><td><div className="omni-row-actions"><button className="omni-quiet" onClick={() => setCart(current => ({...current, [p.id]: Math.min(p.quantity_on_hand, (current[p.id] || 0) + 1)}))} disabled={p.quantity_on_hand <= (cart[p.id] || 0)}>Add to sale</button><button className="omni-quiet" onClick={() => {setAdjusting(p);setDelta("");setReason("");}}>Adjust</button></div></td></tr>)}</tbody></table></div>}
        <section className="omni-sale-panel">
          <div className="omni-panel-head"><div><h2>Cash point of sale</h2><p>Records a real cash sale, decrements stock and posts balanced retail ledger entries. No external payment is initiated.</p></div><span className="omni-sale-count">{cartLines.reduce((n,p) => n + cart[p.id],0)} items</span></div>
          {cartLines.length === 0 ? <div className="omni-empty">Add an in-stock product to begin a cash sale.</div> : <>
            {cartLines.map(p => <div className="omni-cart-line" key={p.id}><div><b>{p.name}</b><small>{money(p.selling_price)} each · available {p.quantity_on_hand}</small></div><div className="omni-cart-controls"><button type="button" className="omni-quiet" onClick={() => setCart(current => ({...current, [p.id]: Math.max(0, (current[p.id] || 0) - 1)}))}>−</button><b>{cart[p.id]}</b><button type="button" className="omni-quiet" disabled={(cart[p.id] || 0) >= p.quantity_on_hand} onClick={() => setCart(current => ({...current, [p.id]: Math.min(p.quantity_on_hand, (current[p.id] || 0) + 1)}))}>＋</button></div><strong>{money(p.selling_price * cart[p.id])}</strong></div>)}
            <div className="omni-cart-total"><span>Cash due</span><b>{money(cartTotal)}</b></div>
            <button className="omni-primary" disabled={busy} onClick={() => void completeCashSale()}>{busy ? "Recording sale…" : "Record cash sale"}</button>
          </>}
        </section>
      </section>
      {adjusting && <div className="omni-modal-backdrop"><form className="omni-modal" onSubmit={submitAdjustment}><button type="button" className="omni-close" onClick={() => setAdjusting(null)} aria-label="Close">×</button><h2>Adjust stock</h2><p>{adjusting.name} · Current stock: {adjusting.quantity_on_hand}</p><label>Quantity change (+ or −)<input required type="number" step="1" value={delta} onChange={e => setDelta(e.target.value)} /></label><label>Reason<input required maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="Purchase, count correction, damage…" /></label><button className="omni-primary" disabled={busy || !Number(delta)}>{busy ? "Saving…" : "Record stock adjustment"}</button></form></div>}
      <p className="omni-foot">Production-connected workspace · Financial actions remain disabled until the real payment partner and reconciliation controls are configured.</p>
    </div>
    <style jsx global>{`
      *{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#16253b;font:14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.omni-shell{min-height:100vh;background:radial-gradient(ellipse at 85% 0,#e4edff 0,transparent 34%),#f3f6fb}.omni-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 max(16px,calc((100vw - 1180px)/2));background:#fff;border-bottom:1px solid #e3eaf4}.omni-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#172a43}.omni-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,#7da4f7,#7cdbb5);font-size:22px;font-weight:950}.omni-brand b{display:block;font-size:18px;letter-spacing:-.5px}.omni-brand small{display:block;font-size:9px;color:#73849a;font-weight:800;letter-spacing:1.3px}.omni-content{max-width:1180px;margin:auto;padding:30px 18px 60px}.omni-heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}.omni-kicker{font-size:10px;font-weight:850;letter-spacing:1.6px;color:#5578b9}.omni-heading h1{font-size:clamp(27px,4vw,36px);letter-spacing:-1.1px;margin:5px 0}.omni-heading p,.omni-panel p{color:#73849a;margin:0}.omni-live{font-size:10px;font-weight:850;letter-spacing:.6px;color:#19734e;background:#e2f7ed;border:1px solid #b9ebd4;border-radius:20px;padding:8px 11px;white-space:nowrap}.omni-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-bottom:18px}.omni-metrics article,.omni-panel{background:#fff;border:1px solid #e1e8f2;border-radius:15px;padding:17px;box-shadow:0 6px 24px #203c6008}.omni-metrics span,.omni-metrics small{display:block;color:#73849a;font-size:12px}.omni-metrics b{display:block;font-size:26px;letter-spacing:-.7px;margin:7px 0 2px}.omni-panel-head{display:flex;align-items:center;justify-content:space-between;gap:14px}.omni-panel h2{font-size:18px;margin:0 0 3px}.omni-primary{border:0;background:#1a3556;color:#fff;padding:11px 14px;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap}.omni-primary:disabled{opacity:.5;cursor:not-allowed}.omni-search{display:block;width:100%;padding:13px 14px;border:1px solid #dce5f0;background:#f9fbfe;border-radius:10px;font:inherit;margin:20px 0 10px;outline-color:#7da4f7}.omni-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:16px;margin-top:18px;background:#f6f9fd;border:1px solid #e0e8f3;border-radius:12px}.omni-form label,.omni-modal label{display:block;font-size:11px;font-weight:750;color:#50627a}.omni-form input,.omni-modal input{display:block;width:100%;margin-top:6px;padding:11px;border:1px solid #d5dfec;background:#fff;border-radius:8px;color:#16253b;font:inherit}.omni-submit{grid-column:1/-1}.omni-row-actions{display:flex;gap:6px}.omni-sale-panel{margin-top:16px;background:#f7faff;border:1px solid #dce7f5;border-radius:12px;padding:16px}.omni-sale-count{font-size:10px;background:#e6eefc;color:#35598d;padding:6px 9px;border-radius:20px;white-space:nowrap}.omni-cart-line{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #e3eaf4}.omni-cart-line>div:first-child{flex:1;min-width:0}.omni-cart-line b,.omni-cart-line small{display:block}.omni-cart-line small{font-size:10px;color:#7c8ca1;margin-top:3px}.omni-cart-line>strong{font-size:12px;white-space:nowrap}.omni-cart-controls{display:flex;align-items:center;gap:8px}.omni-cart-total{display:flex;justify-content:space-between;align-items:center;padding:15px 0;font-size:12px}.omni-cart-total b{font-size:21px}.omni-table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:680px}th,td{text-align:left;padding:13px 10px;border-bottom:1px solid #edf1f6;font-size:12px;white-space:nowrap}th{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#718198}td b,td small{display:block}td small{color:#8290a2;font-size:10px;margin-top:3px}.omni-low,.omni-stock{display:inline-block;min-width:28px;text-align:center;border-radius:7px;padding:4px 7px;font-weight:850}.omni-low{background:#fff0db;color:#9c5a08}.omni-stock{background:#e9f6ef;color:#26734f}.omni-quiet{border:1px solid #dce5f0;background:#fff;color:#39516f;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:750;cursor:pointer}.omni-alert{border:1px solid #e6c98d;background:#fff9e9;color:#664b18;padding:15px;border-radius:12px;margin-bottom:18px}.omni-alert p{margin:5px 0 10px}.omni-alert small{display:block;overflow-wrap:anywhere;margin:8px 0}.omni-alert button{border:1px solid #d9c18b;background:#fff;color:#664b18;border-radius:8px;padding:7px 10px}.omni-empty{text-align:center;padding:30px 12px;color:#7d8da2;font-size:12px}.omni-foot{font-size:11px;color:#8290a2;margin-top:18px}.omni-modal-backdrop{position:fixed;inset:0;background:#10213a88;display:grid;place-items:center;padding:18px;z-index:20}.omni-modal{position:relative;width:min(100%,420px);background:#fff;border-radius:16px;padding:24px;box-shadow:0 24px 80px #09182a40}.omni-modal h2{margin:0 0 4px}.omni-modal p{color:#718198;font-size:12px;margin:0 0 18px}.omni-modal label{margin:12px 0}.omni-modal .omni-primary{width:100%;margin-top:8px}.omni-close{position:absolute;right:12px;top:10px;border:0;background:transparent;font-size:24px;color:#65758a}@media(min-width:760px){.omni-content{padding-top:38px}.omni-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.omni-panel{padding:22px}.omni-form{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:480px){.omni-content{padding:22px 12px 50px}.omni-heading{align-items:flex-start;flex-direction:column}.omni-panel{padding:13px}.omni-panel-head{align-items:flex-start}.omni-panel-head h2{font-size:16px}.omni-panel-head p{font-size:11px}.omni-form{grid-template-columns:1fr;padding:12px}.omni-submit{grid-column:auto}.omni-live{font-size:9px}.omni-metrics article{padding:13px}.omni-metrics b{font-size:22px}}
    `}</style>
  </main>;
}
