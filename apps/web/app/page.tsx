export const dynamic='force-dynamic';
import Link from 'next/link';
import { ProductCard } from '../components/ProductCard';
import { SERVER_API, type Product } from '../lib/api';

export default async function Home() {
  const [products, meta] = await Promise.all([
    fetch(`${SERVER_API}/products?limit=12`, { cache: 'no-store' }).then((r) => r.json()) as Promise<{ items: Product[] }>,
    fetch(`${SERVER_API}/products/meta/filters`, { cache: 'no-store' }).then((r) => r.json()) as Promise<{ manufacturers: { name: string }[] }>,
  ]);
  const sale = products.items.filter((p) => p.salePrice !== undefined && p.salePrice < Number(p.grossPrice)).slice(0, 4);
  const popular = products.items.filter((p) => !sale.some((x) => x.id === p.id)).slice(0, 4);
  return <>
    <section className="hero"><div className="container"><span className="pill">Autóhoz illő alkatrész, gyorsan</span><h1>Találd meg azt az alkatrészt, ami tényleg passzol.</h1><p>Válassz autót, keress cikkszámra vagy böngéssz kategóriák szerint. A kompatibilitási jelzés segít elkerülni a téves rendelést.</p><div style={{display:'flex',gap:12,marginTop:22,flexWrap:'wrap'}}><Link className="button" href="/products">Alkatrészek keresése</Link><Link className="button secondary" href="/garage">Autó kiválasztása</Link></div></div></section>
    <section className="section"><div className="container"><h2>Kiemelt kategóriák</h2><div className="grid">{[['Fék','fek'],['Szűrők','szurok'],['Motorolaj','motorolaj'],['Futómű','futomu'],['Világítás','vilagitas'],['Akkumulátor','akkumulator'],['Karosszéria','karosszeria'],['Kiegészítők','kiegeszitok']].map(([name,slug])=><Link className="panel" href={`/category/${slug}`} key={slug}><strong>{name}</strong><p className="muted">Alkatrészek és kompatibilitási találatok.</p></Link>)}</div></div></section>
    {sale.length>0&&<section className="section"><div className="container"><h2>Aktuális akciók</h2><div className="grid">{sale.map((p)=><ProductCard key={p.id} p={p}/>)}</div></div></section>}
    <section className="section"><div className="container"><h2>Népszerű választások</h2><div className="grid">{popular.map((p)=><ProductCard key={p.id} p={p}/>)}</div></div></section>
    <section className="section"><div className="container"><h2>Gyártói márkák</h2><div className="toolbar">{meta.manufacturers.slice(0,12).map((m)=><Link className="button secondary" key={m.name} href={`/products?manufacturer=${encodeURIComponent(m.name)}`}>{m.name}</Link>)}</div></div></section>
  </>;
}
