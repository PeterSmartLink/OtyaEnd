"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { sku: string; name: string; category: string; price: number; description: string };
type QuoteLine = { sku: string; name: string; quantity: number; unitPrice: number; lineTotal: number };
type Quote = { currency: "UGX"; subtotal: number; total: number; lines: QuoteLine[]; paymentsEnabled: false; demo: true };

const API = "https://omnipoint-api-preview.petersmartlink.workers.dev";
const money = (value: number) => "UGX " + value.toLocaleString("en-UG");

export default function OmniPointShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let active = true;
    fetch(API + "/api/catalog")
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalogue service is not available right now.");
        return response.json();
      })
      .then((body: { data?: Product[] }) => {
        if (active) setProducts(Array.isArray(body.data) ? body.data : []);
      })
      .catch(() => { if (active) setError("We couldn’t connect to the demo catalogue. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const visible = products.filter((p) =>
    (category === "All" || p.category === category) &&
    (p.name + " " + p.description + " " + p.sku).toLowerCase().includes(query.toLowerCase())
  );
  const itemCount = Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

  async function updateQuote(nextCart: Record<string, number>) {
    setCart(nextCart);
    setError("");
    if (!Object.values(nextCart).some((quantity) => quantity > 0)) { setQuote(null); return; }
    setQuoting(true);
    try {
      const response = await fetch(API + "/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: Object.entries(nextCart).filter(([, quantity]) => quantity > 0).map(([sku, quantity]) => ({ sku, quantity })) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not calculate your quote.");
      setQuote(body.data as Quote);
    } catch {
      setQuote(null);
      setError("We couldn’t calculate the quote. Please check your connection and try again.");
    } finally { setQuoting(false); }
  }

  return (
    <main className="shop-shell">
      <header className="shop-header">
        <a href="/omnipoint" className="shop-brand" aria-label="OmniPoint staff workspace"><span className="shop-mark">O</span><span><b>OmniPoint</b><small>SHOP & SERVICES</small></span></a>
        <a className="shop-cart" href="#basket">Basket <b>{itemCount}</b></a>
      </header>
      <section className="shop-hero">
        <div className="shop-kicker">MADE FOR EVERYDAY BUSINESS</div>
        <h1>Good products.<br /><span>Clear prices.</span></h1>
        <p>Explore sample phones, accessories and electronics from the OmniPoint demo shop.</p>
        <div className="shop-demo"><span className="shop-dot" /> Live API preview · Sample catalogue · No payment collected</div>
      </section>
      <section className="shop-content">
        <div className="shop-section-title"><div><span className="shop-kicker">THE DEMO CATALOGUE</span><h2>Find what you need</h2></div><span className="shop-count">{products.length} sample items</span></div>
        <input className="shop-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products or accessories…" aria-label="Search products" />
        <div className="shop-categories" role="group" aria-label="Product category">
          {categories.map((name) => <button key={name} className={category === name ? "selected" : ""} onClick={() => setCategory(name)}>{name}</button>)}
        </div>
        {loading && <div className="shop-state">Connecting to OmniPoint catalogue…</div>}
        {error && <div className="shop-error" role="status">{error}</div>}
        {!loading && !error && <div className="shop-products">{visible.map((product, index) => (
          <article className="shop-product" key={product.sku}>
            <div className={"shop-product-art art-" + (index % 4)}><span>{product.category}</span><div className="shop-product-symbol">{product.category.toLowerCase().includes("phone") ? "▯" : product.category.toLowerCase().includes("audio") ? "◖" : product.category.toLowerCase().includes("power") ? "ϟ" : "◇"}</div><small>{product.sku}</small></div>
            <div className="shop-product-info"><span className="shop-product-category">{product.category}</span><h3>{product.name}</h3><p>{product.description}</p><div className="shop-product-bottom"><b>{money(product.price)}</b><button onClick={() => updateQuote({ ...cart, [product.sku]: Math.min(20, (cart[product.sku] || 0) + 1) }}>Add <span>＋</span></button></div></div>
          </article>
        ))}</div>}
        {!loading && !error && visible.length === 0 && <div className="shop-state">No products match that search.</div>}
        <section id="basket" className="shop-basket">
          <div><span className="shop-kicker">YOUR BASKET</span><h2>Review your items</h2><p>Get an estimate before visiting or contacting the shop.</p></div>
          {!itemCount ? <div className="shop-empty">Your basket is empty. Add a product to get started.</div> : <div className="shop-basket-lines">{Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([sku, quantity]) => {
            const product = products.find((p) => p.sku === sku);
            if (!product) return null;
            return <div className="shop-basket-line" key={sku}><div><b>{product.name}</b><small>{money(product.price)} each</small></div><div className="shop-qty"><button aria-label={"Remove one " + product.name} onClick={() => updateQuote({ ...cart, [sku]: Math.max(0, quantity - 1) })}>−</button><span>{quantity}</span><button aria-label={"Add one " + product.name} onClick={() => updateQuote({ ...cart, [sku]: Math.min(20, quantity + 1) })}>＋</button></div><strong>{money(product.price * quantity)}</strong></div>;
          })}</div>}
          {itemCount > 0 && <div className="shop-total"><span>Estimated total</span><b>{quoting ? "Calculating…" : quote ? money(quote.total) : "—"}</b></div>}
          {itemCount > 0 && <p className="shop-disclaimer">This is an estimate from the demo API, not a confirmed order. Stock availability, delivery and final pricing must be confirmed with the shop.</p>}
          <button className="shop-clear" disabled={!itemCount} onClick={() => { setCart({}); setQuote(null); setError(""); }}>Clear basket</button>
        </section>
        <footer className="shop-footer"><b>OmniPoint</b><span>Simple shopping for everyday needs.</span><small>Demo only · No account, personal details or payment required</small></footer>
      </section>
      <style jsx global>{`
        *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#f6f8fc;color:#17263b;font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.shop-shell{min-height:100vh}.shop-header{height:72px;display:flex;align-items:center;justify-content:space-between;padding:0 max(18px,calc((100vw - 1160px)/2));background:#fff;border-bottom:1px solid #e5eaf2}.shop-brand{display:flex;align-items:center;gap:10px;color:#17263b;text-decoration:none}.shop-mark{width:40px;height:40px;display:grid;place-items:center;border-radius:13px;background:linear-gradient(140deg,#8aaaff,#79e0bc);font-size:22px;font-weight:950;color:#10213a}.shop-brand b{display:block;font-size:19px;letter-spacing:-.6px}.shop-brand small{display:block;color:#74849a;font-size:9px;letter-spacing:1.5px;font-weight:800}.shop-cart{display:flex;align-items:center;gap:10px;text-decoration:none;color:#263952;font-size:13px;font-weight:750}.shop-cart b{display:grid;place-items:center;width:28px;height:28px;background:#e8efff;color:#3155a0;border-radius:50%}.shop-hero{background:radial-gradient(ellipse at 85% 10%,#2d5479 0,transparent 40%),linear-gradient(120deg,#0d1c30,#142c48);color:#fff;padding:58px max(20px,calc((100vw - 1120px)/2)) 52px}.shop-kicker{font-size:10px;letter-spacing:1.8px;font-weight:850;color:#6181c7}.shop-hero .shop-kicker{color:#a8c6ff}.shop-hero h1{font-size:clamp(36px,7vw,64px);line-height:1.03;letter-spacing:-2.5px;margin:13px 0 15px}.shop-hero h1 span{color:#85e0bf}.shop-hero>p{max-width:510px;color:#c0cee0;font-size:16px;margin:0}.shop-demo{display:inline-flex;align-items:center;gap:8px;border:1px solid #405873;background:#142b43;border-radius:30px;padding:9px 13px;margin-top:26px;font-size:11px;color:#d8e5f5}.shop-dot{width:7px;height:7px;border-radius:50%;background:#7ce0b9;box-shadow:0 0 0 4px #7ce0b920}.shop-content{max-width:1160px;margin:auto;padding:42px 20px}.shop-section-title{display:flex;justify-content:space-between;align-items:end;gap:12px}.shop-section-title h2,.shop-basket h2{font-size:clamp(24px,4vw,32px);letter-spacing:-.8px;margin:5px 0 0}.shop-count{color:#77869a;font-size:12px}.shop-search{display:block;width:100%;padding:14px 16px;border:1px solid #dfe6f0;border-radius:12px;background:#fff;color:#17263b;margin:23px 0 13px;font:inherit;outline-color:#789bdf}.shop-categories{display:flex;gap:8px;overflow:auto;padding:2px 0 18px}.shop-categories button{white-space:nowrap;border:1px solid #e0e7f0;background:#fff;border-radius:25px;padding:8px 13px;color:#56677d;font-size:12px;font-weight:700}.shop-categories button.selected{background:#182e49;color:#fff;border-color:#182e49}.shop-products{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.shop-product{background:#fff;border:1px solid #e6ebf3;border-radius:16px;overflow:hidden;min-width:0;box-shadow:0 4px 16px #19365708}.shop-product-art{height:140px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(145deg,#d9e5fa,#eff5ff)}.shop-product-art:before{content:"";position:absolute;width:135px;height:135px;border-radius:50%;background:#ffffff65;right:-30px;top:-50px}.shop-product-art>span{position:absolute;top:11px;left:11px;background:#ffffffbf;border-radius:6px;padding:4px 7px;font-size:9px;font-weight:800;color:#536783}.shop-product-symbol{font-size:72px;line-height:1;font-weight:300;color:#264969;text-shadow:0 12px 25px #203e6024;z-index:1}.shop-product-art>small{position:absolute;bottom:10px;right:12px;color:#526c8a;font-size:9px;letter-spacing:1px}.art-1{background:linear-gradient(145deg,#d7f0e8,#f0faf6)}.art-2{background:linear-gradient(145deg,#f4e6d5,#fff7ee)}.art-3{background:linear-gradient(145deg,#e8e0fa,#f8f5ff)}.shop-product-info{padding:13px}.shop-product-category{font-size:9px;color:#7084a0;font-weight:850;text-transform:uppercase;letter-spacing:1px}.shop-product h3{font-size:14px;line-height:1.3;margin:4px 0 5px;letter-spacing:-.2px}.shop-product p{font-size:11px;line-height:1.45;color:#7b899b;margin:0;min-height:32px}.shop-product-bottom{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:14px}.shop-product-bottom>b{font-size:13px;letter-spacing:-.3px}.shop-product-bottom button{display:flex;align-items:center;gap:6px;border:0;border-radius:9px;background:#172e4a;color:#fff;padding:9px 10px;font-size:11px;font-weight:800;white-space:nowrap}.shop-product-bottom button span{font-size:15px}.shop-state,.shop-error{padding:25px 15px;text-align:center;border:1px dashed #cbd6e5;border-radius:12px;color:#708096;margin:10px 0}.shop-error{border-color:#efc8c8;background:#fff7f7;color:#9c3e3e}.shop-basket{margin-top:42px;padding:22px;background:#fff;border:1px solid #e4eaf3;border-radius:18px}.shop-basket>div:first-child>p{color:#78889c;font-size:13px;margin:6px 0 0}.shop-empty{padding:22px 0;color:#8290a1;font-size:13px}.shop-basket-lines{margin-top:16px}.shop-basket-line{display:flex;align-items:center;gap:10px;padding:14px 0;border-bottom:1px solid #edf0f5}.shop-basket-line>div:first-child{flex:1;min-width:0}.shop-basket-line b{display:block;font-size:12px}.shop-basket-line small{display:block;color:#8290a1;font-size:10px;margin-top:3px}.shop-basket-line>strong{font-size:12px;white-space:nowrap}.shop-qty{display:flex;align-items:center;gap:8px}.shop-qty button{border:1px solid #dfe6f0;background:#f7f9fc;color:#172e4a;border-radius:7px;width:28px;height:28px;font-size:15px}.shop-qty span{font-size:12px;font-weight:800}.shop-total{display:flex;justify-content:space-between;align-items:center;padding:18px 0 6px}.shop-total span{font-size:13px;color:#6c7c90}.shop-total b{font-size:21px;letter-spacing:-.5px}.shop-disclaimer{font-size:11px;line-height:1.6;color:#7d8a9c;background:#f6f8fc;padding:11px;border-radius:8px}.shop-clear{border:1px solid #dfe6f0;background:#fff;color:#52657d;border-radius:9px;padding:10px 13px;font-size:11px;font-weight:800}.shop-clear:disabled{opacity:.4}.shop-footer{display:flex;flex-wrap:wrap;align-items:center;gap:10px;border-top:1px solid #e5eaf2;margin-top:40px;padding-top:20px;color:#6f7f93;font-size:12px}.shop-footer b{color:#263952}.shop-footer small{flex-basis:100%;font-size:10px;color:#95a1b1}@media(min-width:680px){.shop-hero{padding-top:76px;padding-bottom:70px}.shop-products{grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.shop-product-art{height:190px}.shop-product-info{padding:17px}.shop-product h3{font-size:16px}.shop-product p{font-size:12px;min-height:36px}.shop-product-bottom>b{font-size:15px}.shop-basket{padding:28px}.shop-basket-line{gap:18px}}@media(min-width:960px){.shop-products{grid-template-columns:repeat(4,minmax(0,1fr))}.shop-content{padding-top:52px}.shop-product-art{height:175px}}@media(max-width:390px){.shop-content{padding:30px 12px}.shop-product-art{height:112px}.shop-product-info{padding:10px}.shop-product h3{font-size:12px}.shop-product-bottom{align-items:flex-start;flex-direction:column}.shop-product-bottom button{width:100%;justify-content:center}.shop-basket{padding:15px}.shop-qty{gap:5px}}
      `}</style>
    </main>
  );
}
