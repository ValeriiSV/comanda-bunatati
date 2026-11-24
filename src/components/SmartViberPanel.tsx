import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {listCollection,getDocument} from '@/lib/firebaseRest';
import {effectiveRound,groupRoundOrders,supplierSignature,type GroupableOrder} from '@/lib/orderRounds';
const money=(b:number)=>(b/100).toFixed(2).replace('.',',')+' lei';
type Order=GroupableOrder & {supplierConfirmedKey?:string};
export default function SmartViberPanel(){
 const [rows,setRows]=useState<Order[]>([]),[label,setLabel]=useState(''),[closed,setClosed]=useState(false),[link,setLink]=useState(''),[kind,setKind]=useState('ready'),[notice,setNotice]=useState('');
 const load=async()=>{try{const [orders,s,p]=await Promise.all([listCollection('groupOrders') as Promise<Order[]>,getDocument('settings/orderSchedule'),getDocument('settings/miaCollector')]);setRows(orders.filter(o=>effectiveRound(o).roundId===s?.roundId));setLabel(String(s?.roundLabel||''));setClosed(s?.closed===true);let url='';try{const u=new URL(String(p?.paymentLink||''));if(u.protocol==='https:'&&u.hostname==='mia-qr.bnm.md'&&!u.username&&!u.password&&!u.port)url=u.href;}catch{}setLink(url);setNotice('');}catch(e){setNotice((e as Error).message);}};
 useEffect(()=>{void load();},[]);
 const groups=groupRoundOrders(rows),eligible=kind==='ready'?groups.filter(g=>g.status==='Gata de ridicare'):groups.filter(g=>g.totalBani>g.paidBani);
 const valid=kind==='ready'||closed&&!!link&&rows.every(o=>o.supplierConfirmedKey===supplierSignature(o));
 const message=valid&&eligible.length?['🥜 Bunătăți împreună cu Valera',label,kind==='ready'?'Comenzile sunt gata de ridicare:':'Reamintire: sumele rămase de achitat prin MIA:',...eligible.map(g=>(g.entries[0].customerName||'Client').replace(/\s+/g,' ')+(kind==='ready'?'':' — '+money(g.totalBani-g.paidBani))),...(kind==='ready'?['Mulțumesc!']:[link,'Verificați beneficiarul și introduceți suma indicată. Mulțumesc!'])].join('\n'):'';
 const copy=async()=>{try{await navigator.clipboard.writeText(message);setNotice('Mesaj copiat.');}catch{setNotice('Selectează textul manual.');}};
 return <section className="rounded-[24px] border bg-white p-4 space-y-3"><h2 className="font-serif text-xl">Mesaje inteligente Viber</h2><select className="w-full rounded-xl border p-3" value={kind} onChange={e=>setKind(e.target.value)}><option value="ready">Gata de ridicare</option><option value="debt">Rest de achitat</option></select><Button variant="outline" onClick={()=>void load()}>Actualizează</Button>{!valid&&<p className="text-sm">Închide și confirmă runda, apoi configurează MIA.</p>}{message?<><textarea readOnly className="w-full min-h-48 rounded-xl border p-3" value={message}/><div className="flex flex-wrap gap-2"><Button onClick={()=>void copy()}>Copiază</Button><Button variant="outline" onClick={()=>{if(navigator.share)void navigator.share({text:message}).catch(()=>{});else void copy();}}>Distribuie</Button></div></>:<p className="text-sm">Nicio comandă eligibilă.</p>}{notice&&<p role="status">{notice}</p>}</section>;
}
