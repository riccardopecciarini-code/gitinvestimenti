const WATCHLIST=[
 {name:'Banca Ifis',ticker:'IF.MI'},{name:'Unipol',ticker:'UNI.MI'},{name:'Microsoft',ticker:'MSFT'},{name:'Amazon',ticker:'AMZN'},{name:'Meta Platforms',ticker:'META'}
];
const FMP='https://financialmodelingprep.com/stable/';
let stocks=[], selectedTicker=WATCHLIST[0].ticker;
const views=[...document.querySelectorAll('.view')];
const $=id=>document.getElementById(id);
function showView(id){views.forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===id));const titles={dashboard:'Dashboard',watchlist:'Watchlist',portfolio:'Portafoglio',analysis:'Analisi titolo',alerts:'Alert'};$('page-title').textContent=titles[id]||'Dashboard';window.scrollTo(0,0)}
document.querySelectorAll('.nav-item').forEach(b=>b.onclick=()=>showView(b.dataset.view));
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>showView(b.dataset.go));
$('settings').onclick=()=>{$('api-key').value=localStorage.getItem('fmp_api_key')||'';$('settings-modal').classList.add('open')};
$('close-settings').onclick=()=>$('settings-modal').classList.remove('open');
$('clear-key').onclick=()=>{localStorage.removeItem('fmp_api_key');stocks=[];renderAll();$('settings-modal').classList.remove('open')};
$('save-key').onclick=()=>{const k=$('api-key').value.trim();if(!k)return alert('Inserisci una API key.');localStorage.setItem('fmp_api_key',k);$('settings-modal').classList.remove('open');loadAll()};
$('refresh').onclick=()=>loadAll();
$('add-ticker').onclick=()=>{const t=prompt('Ticker FMP (es. AAPL, MSFT, UNI.MI, IF.MI):');if(t){WATCHLIST.push({name:t.toUpperCase(),ticker:t.toUpperCase()});populateSelect();loadAll()}};
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}
function fmt(n,dec=2){return n==null?'—':n.toLocaleString('it-IT',{minimumFractionDigits:dec,maximumFractionDigits:dec})}
function money(n,currency='€'){return n==null?'—':currency+fmt(n)}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
async function api(path){const key=localStorage.getItem('fmp_api_key');if(!key)throw new Error('API key non configurata');const r=await fetch(FMP+path+(path.includes('?')?'&':'?')+'apikey='+encodeURIComponent(key));if(!r.ok)throw new Error('API HTTP '+r.status);const j=await r.json();if(!Array.isArray(j)&&j['Error Message'])throw new Error(j['Error Message']);return Array.isArray(j)?j[0]:j}
async function getStock(w){
 const [q,p,r,i,c,b]=await Promise.all([
  api('quote?symbol='+encodeURIComponent(w.ticker)),api('profile?symbol='+encodeURIComponent(w.ticker)),api('ratios-ttm?symbol='+encodeURIComponent(w.ticker)),api('income-statement?symbol='+encodeURIComponent(w.ticker)+'&limit=5'),api('cash-flow-statement?symbol='+encodeURIComponent(w.ticker)+'&limit=5'),api('balance-sheet-statement?symbol='+encodeURIComponent(w.ticker)+'&limit=1')
 ]);
 return buildStock(w,q,p,r,i,c,b);
}
function buildStock(w,q,p,r,inc,cash,bal){
 const Q=q||{}, P=p||{}, R=r||{}, I=inc||{}, C=cash||{}, B=bal||{};
 const price=num(Q.price), eps=num(R.netIncomePerShareTTM)||num(Q.eps), bvps=num(R.bookValuePerShareTTM), fcfps=num(R.freeCashFlowPerShareTTM), pe=num(R.priceToEarningsRatioTTM)||num(Q.pe), ps=num(R.priceToSalesRatioTTM), pb=num(R.priceToBookRatioTTM), roe=num(R.returnOnEquityTTM), margin=num(R.netProfitMarginTTM), debt=num(R.debtToEquityRatioTTM), div=num(R.dividendYieldTTM);
 const revGrowth=calcGrowth(inc,'revenue'), epsGrowth=calcGrowth(inc,'netIncomePerShare');
 const fcfGrowth=calcGrowth(cash,'freeCashFlow');
 const fair=calcFair({price,eps,bvps,fcfps,pe,roe,revGrowth,epsGrowth,isBank:isBank(w,P)});
 const scores=score({price,pe,pb,ps,roe,margin,debt,revGrowth,epsGrowth,fcfGrowth,div,fair,q:Q});
 return {name:P.companyName||w.name,ticker:w.ticker,price,currency:P.currency||'EUR',change:num(Q.changesPercentage),pe,pb,ps,eps,bvps,fcfps,roe,margin,debt,div,revGrowth,epsGrowth,fcfGrowth,fair,...scores,industry:P.industry||'—',sector:P.sector||'—',exchange:P.exchangeShortName||'—',website:P.website||''};
}
function isBank(w,p){return /bank|credit|insurance|financial/i.test((p.industry||'')+' '+(p.sector||'')+' '+w.name)}
function latestTwo(arr,key){if(!Array.isArray(arr)||arr.length<2)return null;const a=num(arr[0]?.[key]),b=num(arr[1]?.[key]);return a!=null&&b!=null&&b!==0?{a,b}:null}
function calcGrowth(arr,key){const x=latestTwo(arr,key);return x?Math.pow(x.a/x.b,1/Math.min(1,1))-1:null}
function calcFair(x){
 if(x.isBank && x.bvps>0){
  const roe=clamp(x.roe||0.10,0.04,0.30), cost=0.10, fairPB=clamp(roe/cost,0.55,2.2);
  const pbFair=x.bvps*fairPB, peFair=x.eps>0?x.eps*clamp(10+(x.epsGrowth||0)*100*0.35,9,22):null;
  return weighted([pbFair,peFair],[0.60,0.40]);
 }
 const growth=clamp((x.epsGrowth||x.revGrowth||0),-0.10,0.35);
 const justifiedPE=clamp(12+growth*35,10,32);
 const peFair=x.eps>0?x.eps*justifiedPE:null;
 const graham=x.eps>0&&x.bvps>0?Math.sqrt(22.5*x.eps*x.bvps):null;
 const dcf=x.fcfps>0?dcfLite(x.fcfps,growth):null;
 return weighted([peFair,graham,dcf],[0.40,0.25,0.35]);
}
function dcfLite(fcf,g){const gr=clamp(g,0,0.25),r=0.095;let pv=0,v=fcf;for(let y=1;y<=5;y++){v*=1+gr;pv+=v/Math.pow(1+r,y)}const tv=v*1.025/(r-0.025);return pv+tv/Math.pow(1+r,5)}
function weighted(vals,w){const ok=vals.map((v,i)=>v!=null&&Number.isFinite(v)?[v,w[i]]:null).filter(Boolean);return ok.length?ok.reduce((s,x)=>s+x[0]*x[1],0)/ok.reduce((s,x)=>s+x[1],0):null}
function score(x){
 const value=clamp(50+(x.fair&&x.price?((x.fair/x.price)-1)*100:0),0,100);
 const growth=clamp(50+(x.revGrowth||0)*80+(x.epsGrowth||0)*120,0,100);
 const quality=clamp(45+(x.roe||0)*120+(x.margin||0)*70-(x.debt||0)*5,0,100);
 const momentum=clamp(50+(num(x.q?.changesPercentage)||0)*8,0,100);
 const risk=clamp(75-(x.debt||0)*15-(Math.abs(num(x.q?.dayLow)-num(x.q?.dayHigh))/(x.price||1))*80,0,100);
 const income=clamp(40+(x.div||0)*800,0,100);
 const total=Math.round(value*.25+growth*.20+quality*.20+momentum*.15+risk*.10+income*.10);
 return {value,growth,quality,momentum,risk,income,total,signal:total>=80?'Strong Buy':total>=70?'Interessante':total>=55?'Watch':'Debole'};
}
function renderAll(){
 $('watch-count').textContent=WATCHLIST.length;
 $('data-status').textContent=stocks.length?'Dati reali · FMP':'API non configurata';
 $('system-status').textContent=stocks.length?'Dati aggiornati':'Sistema pronto';
 $('market-state').textContent=stocks.length?'Online':'Non configurato';
 $('time').textContent=stocks.length?new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'—';
 $('watch-table').innerHTML=(stocks.length?stocks:WATCHLIST.map(w=>({name:w.name,ticker:w.ticker}))).map(row=>rowHtml(row)).join('');
 const valid=stocks.filter(x=>x.fair&&x.price);$('value-count').textContent=valid.filter(x=>x.fair/x.price>1.2).length||'0';$('quality-count').textContent=valid.filter(x=>x.quality>=75).length||'0';
 $('signals').innerHTML=(stocks.length?stocks.slice().sort((a,b)=>b.total-a.total).slice(0,4):WATCHLIST.slice(0,4).map(w=>({name:w.name,ticker:w.ticker}))).map(x=>'<div class="signal"><div class="signal-title"><span class="signal-icon">'+x.ticker.slice(0,2)+'</span><div><b>'+x.name+'</b><small>'+x.ticker+(x.pe?' · P/E '+fmt(x.pe,1)+'x':'')+'</small></div></div><div class="signal-right"><b class="'+(x.total>=70?'up':'')+'">'+(x.fair?fmt((x.fair/x.price-1)*100,1)+'%':'—')+'</b><small>'+(x.signal||'Da aggiornare')+'</small></div></div>').join('');
 $('bars').innerHTML=stocks.length?['Value','Growth','Quality','Momentum','Risk'].map(k=>{const key=k.toLowerCase();const vals=stocks.map(x=>x[key]).filter(Number.isFinite);const v=vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0;return '<div class="bar-row"><span>'+k+'</span><div><i style="width:'+v+'%"></i></div><b>'+v+'</b></div>'}).join(''):'<p class="thesis">Configura l’API per attivare il pulse.</p>';
 if(stocks.length) renderAnalysis(stocks.find(x=>x.ticker===selectedTicker)||stocks[0]);
 populateSelect();
}
function rowHtml(x){return '<tr><td><b>'+x.name+'</b><small> '+x.ticker+'</small></td><td>'+money(x.price,x.currency==='USD'?'$':'€')+'</td><td>'+(x.pe?fmt(x.pe,1)+'x':'—')+'</td><td>'+money(x.fair,x.currency==='USD'?'$':'€')+'</td><td class="'+((x.fair&&x.price&&x.fair>x.price)?'up':'down')+'">'+(x.fair&&x.price?fmt((x.fair/x.price-1)*100,1)+'%':'—')+'</td><td><b>'+(x.total??'—')+'</b>/100</td><td><span class="badge '+(x.total>=70?'green':'amber')+'">'+(x.signal||'Da aggiornare')+'</span></td></tr>'}
function populateSelect(){ $('analysis-select').innerHTML=(stocks.length?stocks:WATCHLIST).map(x=>'<option value="'+x.ticker+'" '+(x.ticker===selectedTicker?'selected':'')+'>'+x.name+' · '+x.ticker+'</option>').join('');}
$('analysis-select').onchange=e=>{selectedTicker=e.target.value;renderAnalysis(stocks.find(x=>x.ticker===selectedTicker))};
function renderAnalysis(x){if(!x)return;const cur=x.currency==='USD'?'$':'€';$('a-ticker').textContent=x.ticker;$('a-name').textContent=x.name;$('a-profile').textContent=x.sector+' · '+x.industry+' · '+x.exchange;$('a-price').textContent=money(x.price,cur);$('a-change').textContent=x.change!=null?(x.change>=0?'+':'')+fmt(x.change,2)+'%': '—';$('a-change').className=x.change>=0?'up':'down';$('a-score').innerHTML=(x.total??'—')+'<span>/100</span>';$('a-signal').textContent=x.signal||'—';$('a-signal').className='badge '+(x.total>=70?'green':'amber');
 $('valuation').innerHTML=[['P/E',x.pe?fmt(x.pe,1)+'x':'—'],['P/B',x.pb?fmt(x.pb,2)+'x':'—'],['ROE',x.roe!=null?fmt(x.roe*100,1)+'%':'—'],['Dividend yield',x.div!=null?fmt(x.div*100,1)+'%':'—']].map(v=>'<div><span>'+v[0]+'</span><b>'+v[1]+'</b></div>').join('');
 $('a-fair').textContent=money(x.fair,cur);$('a-fair2').textContent=money(x.fair,cur);$('a-upside').textContent=x.fair&&x.price?((x.fair/x.price-1>=0?'+':'')+fmt((x.fair/x.price-1)*100,1)+' upside'): '—';$('a-upside').className=x.fair>x.price?'up':'down';$('a-buy').textContent=x.fair?money(x.fair*.80,cur):'—';$('a-risk').textContent=x.risk!=null?Math.round(x.risk)+'/100':'—';
 $('profile').innerHTML=[['Value',x.value],['Growth',x.growth],['Quality',x.quality],['Momentum',x.momentum],['Risk',x.risk],['Income',x.income]].map(v=>'<div class="bar-row"><span>'+v[0]+'</span><div><i style="width:'+Math.round(v[1]||0)+'%"></i></div><b>'+Math.round(v[1]||0)+'</b></div>').join('');
 $('a-thesis').textContent='Il modello combina valutazione relativa, crescita, qualità, rischio, momentum e reddito. Un P/E elevato non viene penalizzato automaticamente: se crescita e qualità aumentano, il fair value può salire. Per banche/assicurazioni il modello privilegia P/B e ROE rispetto al FCF.';
}
async function loadAll(){const key=localStorage.getItem('fmp_api_key');if(!key){renderAll();showView('dashboard');return}$('system-status').textContent='Aggiornamento…';try{stocks=await Promise.all(WATCHLIST.map(getStock));renderAll()}catch(e){$('system-status').textContent='Errore dati';$('data-status').textContent=e.message;alert('Aggiornamento non riuscito: '+e.message)}}
loadAll();