import Link from "next/link";
import { getTickerData } from "@/lib/fmp";
import { calculateInvestment } from "@/lib/engine";

export default async function Stock({params}:{params:Promise<{ticker:string}>}){
  const {ticker}=await params;
  const t=decodeURIComponent(ticker);
  let data:any=null;
  let error:string|null=null;

  try{
    const d=await getTickerData(t);
    const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
    const q=d.quote||{}, r=d.ratios||{}, i=d.income||[], c=d.cash||[];
    const financials={
      price:n(q.price),
      eps:n(r.netIncomePerShareTTM)||n(q.eps),
      bookValuePerShare:n(r.bookValuePerShareTTM),
      fcfPerShare:n(r.freeCashFlowPerShareTTM),
      pe:n(r.priceToEarningsRatioTTM)||n(q.pe),
      pb:n(r.priceToBookRatioTTM),
      roe:n(r.returnOnEquityTTM),
      revenueGrowth:i.length>1&&n(i[1].revenue)?n(i[0].revenue)/n(i[1].revenue)-1:0,
      epsGrowth:i.length>1&&n(i[1].netIncomePerShare)?n(i[0].netIncomePerShare)/n(i[1].netIncomePerShare)-1:0,
      fcfGrowth:c.length>1&&n(c[1].freeCashFlow)?n(c[0].freeCashFlow)/n(c[1].freeCashFlow)-1:0,
      debtToEquity:n(r.debtToEquityRatioTTM),
      dividendYield:n(r.dividendYieldTTM),
      sector:d.profile?.sector
    };
    data={ticker:t,name:d.profile?.companyName,price:q.price,currency:d.profile?.currency,change:q.changesPercentage,financials,analysis:calculateInvestment(financials)};
  }catch(e:any){
    error=e?.message||"Errore nel recupero dati";
  }

  if(error) return <Shell><p className="eyebrow">STOCK RESEARCH · LIVE ENGINE</p><h1>{t}</h1><div className="card"><h3>Errore nel recupero dati</h3><p className="red">{error}</p><p className="muted">Controlla la configurazione FMP_API_KEY su Vercel e il deployment di produzione.</p></div></Shell>;

  const a=data.analysis;
  const c=data.currency==="USD"?"$":"€";
  return <Shell>
    <p className="eyebrow">STOCK RESEARCH · LIVE ENGINE</p>
    <div className="top"><div><h1>{data.name||t}</h1><p className="muted">{t} · {data.currency} · aggiornamento server-side</p></div><b className={data.change>=0?"green":"red"}>{Number(data.change||0).toFixed(2)}%</b></div>
    <section className="grid">
      <Metric t="Prezzo" v={c+Number(data.price||0).toFixed(2)}/>
      <Metric t="Fair value" v={a.fairValue?c+a.fairValue.toFixed(2):"—"}/>
      <Metric t="Margin of safety" v={a.marginOfSafety!=null?(a.marginOfSafety*100).toFixed(1)+"%":"—"}/>
      <Metric t="Investment score" v={a.scores.total+"/100"}/>
    </section>
    <section className="two">
      <div className="card"><h3>Scenari</h3><div className="row"><span>Bear</span><b>{c+a.bear.toFixed(2)}</b></div><div className="row"><span>Base</span><b>{a.fairValue?c+a.fairValue.toFixed(2):"—"}</b></div><div className="row"><span>Bull</span><b>{c+a.bull.toFixed(2)}</b></div></div>
      <div className="card"><h3>Factor score</h3><div className="row"><span>Value</span><b>{Math.round(a.scores.value)}</b></div><div className="row"><span>Growth</span><b>{Math.round(a.scores.growth)}</b></div><div className="row"><span>Quality</span><b>{Math.round(a.scores.quality)}</b></div><div className="row"><span>Risk</span><b>{Math.round(a.scores.risk)}</b></div><div className="row"><span>Income</span><b>{Math.round(a.scores.income)}</b></div><p><b>{a.signal}</b></p></div>
    </section>
  </Shell>
}

function Metric({t,v}:{t:string,v:string}){return <div className="card"><span className="muted">{t}</span><strong>{v}</strong></div>}
function Shell({children}:{children:React.ReactNode}){return <div className="shell"><aside className="sidebar"><div className="brand"><span className="mark">G</span><div><b>GitInvestimenti</b><small>Investment Intelligence</small></div></div><nav className="nav"><Link href="/">Dashboard</Link><Link href="/watchlist">Watchlist</Link><Link href="/portfolio">Portafoglio</Link><Link href="/analysis">Analisi</Link><Link href="/alerts">Alert</Link><Link href="/settings">Impostazioni</Link></nav></aside><main className="content">{children}</main></div>}
