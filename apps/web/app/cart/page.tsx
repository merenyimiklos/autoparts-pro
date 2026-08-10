'use client';
import {FormEvent,useEffect,useState} from 'react';
import Link from 'next/link';
import {api,CartResponse} from '../../lib/api';
import {notify} from '../../components/Feedback';

const emptyCart:CartResponse={items:[],itemCount:0,isEmpty:true,subtotalGross:0,discountGross:0,shippingGross:0,totalGross:0};

export default function Cart(){
  const[c,setC]=useState<CartResponse|null>(null);
  const[busy,setBusy]=useState<string|null>(null);
  const[coupon,setCoupon]=useState('');
  const[couponBusy,setCouponBusy]=useState(false);

  async function load(){
    try{const next=await api<CartResponse>('/cart');setC(next);setCoupon(next.couponCode??'')}
    catch(err){notify('error','A kosár nem tölthető be',err instanceof Error?err.message:undefined);setC(emptyCart)}
  }
  useEffect(()=>{void load()},[]);

  async function update(productId:string,quantity:number){
    setBusy(productId);
    try{
      const next=await api<CartResponse>('/cart/items',{method:'PATCH',body:JSON.stringify({productId,quantity})});
      setC(next);window.dispatchEvent(new CustomEvent('autoparts:cart-updated',{detail:next}));
      if(quantity<=0)notify('info','Termék eltávolítva','A terméket kivettük a kosaradból.');
    }catch(err){notify('error','Nem sikerült módosítani a kosarat',err instanceof Error?err.message:undefined)}
    finally{setBusy(null)}
  }

  async function applyCoupon(e:FormEvent){
    e.preventDefault();setCouponBusy(true);
    try{
      const next=await api<CartResponse>('/cart/coupon',{method:'POST',body:JSON.stringify({code:coupon})});
      setC(next);setCoupon(next.couponCode??coupon.trim().toUpperCase());window.dispatchEvent(new CustomEvent('autoparts:cart-updated',{detail:next}));
      notify('success','Kupon alkalmazva',next.discountGross>0?`Kedvezményed: ${Number(next.discountGross).toLocaleString('hu-HU')} Ft`:'A kupon érvényes.');
    }catch(err){notify('error','A kupon nem alkalmazható',err instanceof Error?err.message:undefined)}
    finally{setCouponBusy(false)}
  }

  if(!c)return <main className="section"><div className="container"><div className="panel loading-panel"><div className="spinner"/><p>Kosár betöltése…</p></div></div></main>;
  if(c.isEmpty)return <main className="section"><div className="container"><div className="panel empty-cart-page"><div className="empty-icon">🛒</div><span className="eyebrow">A kosarad</span><h1>Még nincs benne semmi</h1><p className="muted">Válassz alkatrészt a katalógusból. A kosár vendégként is megmarad, belépés után pedig összevonjuk a fiókod kosarával.</p><Link className="button" href="/products">Alkatrészek böngészése</Link></div></div></main>;

  return <main className="section"><div className="container"><div className="page-heading"><div><span className="eyebrow">{c.itemCount} db termék</span><h1>Kosár</h1></div><Link className="button secondary" href="/products">← Vásárlás folytatása</Link></div><div className="cart-layout"><section className="panel cart-lines">{c.items.map(i=><article className="cart-line" key={i.id}><div className="cart-line-image">{i.product.images?.[0]?.url?<img src={i.product.images[0].url} alt={i.product.images[0].alt||i.product.name}/>:<span>🔧</span>}</div><div className="cart-line-main"><strong>{i.product.name}</strong><span className="muted">{Number(i.product.grossPrice).toLocaleString('hu-HU')} Ft / db</span><div className="qty-control"><button disabled={busy===i.productId} onClick={()=>void update(i.productId,i.quantity-1)}>−</button><span>{i.quantity}</span><button disabled={busy===i.productId} onClick={()=>void update(i.productId,i.quantity+1)}>+</button><button disabled={busy===i.productId} className="remove-link" onClick={()=>void update(i.productId,0)}>Eltávolítás</button></div></div><strong className="cart-line-total">{(Number(i.product.grossPrice)*i.quantity).toLocaleString('hu-HU')} Ft</strong></article>)}</section><aside className="panel cart-summary"><h2>Összesítés</h2><div className="summary-row"><span>Termékek</span><strong>{Number(c.subtotalGross).toLocaleString('hu-HU')} Ft</strong></div>{c.discountGross>0&&<div className="summary-row discount"><span>Kedvezmény</span><strong>−{Number(c.discountGross).toLocaleString('hu-HU')} Ft</strong></div>}<form className="coupon-box" onSubmit={applyCoupon}><label className="field-label">Kuponkód<div className="coupon-row"><input className="input" value={coupon} onChange={e=>setCoupon(e.target.value)} placeholder="pl. NYAR10"/><button className="button secondary" disabled={couponBusy}>{couponBusy?'…':'Alkalmaz'}</button></div></label>{c.couponCode&&<small className="coupon-active">Aktív kupon: {c.couponCode}</small>}</form><div className="summary-row"><span>Szállítás</span><span className="muted">a pénztárban</span></div><div className="summary-row total"><span>Részösszeg</span><strong>{Number(c.subtotalGross-c.discountGross).toLocaleString('hu-HU')} Ft</strong></div><Link className="button full-button" href="/checkout">Tovább a pénztárhoz</Link><p className="muted mini-note">A készletet a rendelés leadásakor foglaljuk le tranzakcióbiztosan.</p></aside></div></div></main>;
}
