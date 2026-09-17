import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { ArrowLeft, ClipboardList, PackageCheck, Users } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import './bucuria-admin-pages.css';

type Profile={role?:string};
type Campaign={status?:string;title?:string};
type Item={productId:string;name:string;barcode?:string;qty:number;price:number;unit?:string};
type Order={id:string;userId:string;userName:string;phone?:string;items:Item[];total:number;status:string};

const ADMIN_EMAIL='valerkasvetlicenco@icloud.com';
const money=(v:number)=>new Intl.NumberFormat('ro-MD',{style:'currency',currency:'MDL',maximumFractionDigits:2}).format(v||0);
const labels:Record<string,string>={draft:'În pregătire',open:'Deschisă',closed:'Închisă',sent:'Trimisă furnizorului',received:'Primită',distributed:'Distribuită'};
const statuses=['draft','open','closed','sent','received','distributed'];

export default function BucuriaManagerPage(){
  const [user,setUser]=useState<User|null>(auth.currentUser);
  const [isAdmin,setIsAdmin]=useState(false);
  const [campaign,setCampaign]=useState<Campaign|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [productCount,setProductCount]=useState(0);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,async next=>{
    setUser(next);setIsAdmin(false);
    if(!next)return;
    if(next.email?.toLowerCase()===ADMIN_EMAIL){setIsAdmin(true);return;}
    try{const snap=await getDoc(doc(db,'marketUsers',next.uid));setIsAdmin(snap.exists()&&(snap.data() as Profile).role==='admin');}catch{setIsAdmin(false);}
  }),[]);

  useEffect(()=>{
    if(!isAdmin)return;
    const a=onSnapshot(doc(db,'groupCampaigns','bucuria'),snap=>setCampaign(snap.exists()?snap.data() as Campaign:null),e=>setMessage(e.message));
    const b=onSnapshot(collection(db,'groupCampaigns','bucuria','orders'),snap=>setOrders(snap.docs.map(d=>({id:d.id,...d.data()} as Order))),e=>setMessage(e.message));
    const c=onSnapshot(collection(db,'groupCampaigns','bucuria','products'),snap=>setProductCount(snap.size),e=>setMessage(e.message));
    return()=>{a();b();c();};
  },[isAdmin]);

  const total=orders.reduce((sum,o)=>sum+Number(o.total||0),0);
  const summary=useMemo(()=>{
    const map=new Map<string,{name:string;barcode?:string;qty:number;total:number;unit?:string}>();
    orders.forEach(order=>order.items.forEach(item=>{
      const current=map.get(item.productId)||{name:item.name,barcode:item.barcode,qty:0,total:0,unit:item.unit};
      current.qty+=Number(item.qty||0);current.total+=Number(item.qty||0)*Number(item.price||0);map.set(item.productId,current);
    }));
    return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ro'));
  },[orders]);

  const changeStatus=async(status:string)=>{
    if(!isAdmin)return;setBusy(true);
    try{await setDoc(doc(db,'groupCampaigns','bucuria'),{status,updatedAt:serverTimestamp()},{merge:true});setMessage(`Status schimbat: ${labels[status]}.`);}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };

  if(!user)return <main className="bucuria-page-shell"><section className="bucuria-page-card empty"><h1>Manager Bucuria</h1><p>Autentifică-te ca administrator.</p><Link to="/">Orbico Market</Link></section></main>;
  if(!isAdmin)return <main className="bucuria-page-shell"><section className="bucuria-page-card empty"><h1>Acces administrator</h1><p>Pagina Manager este disponibilă doar administratorului Orbico Market.</p><Link to="/bucuria">Înapoi la Bucuria</Link></section></main>;

  return <main className="bucuria-page-shell">
    <header className="bucuria-page-head"><Link to="/bucuria"><ArrowLeft size={18}/> Bucuria</Link><div><span>ORBICO MARKET · ADMIN</span><h1>Manager Bucuria</h1></div></header>
    {message&&<button className="bucuria-page-message" onClick={()=>setMessage('')}>{message}</button>}
    <section className="bucuria-manager-stats">
      <div><PackageCheck size={20}/><span>Produse</span><strong>{productCount}</strong></div>
      <div><Users size={20}/><span>Comenzi</span><strong>{orders.length}</strong></div>
      <div><ClipboardList size={20}/><span>Total</span><strong>{money(total)}</strong></div>
    </section>
    <section className="bucuria-page-card">
      <div className="bucuria-page-title"><div><span>STATUS CAMPANIE</span><h2>{labels[campaign?.status||'draft']||'În pregătire'}</h2></div></div>
      <div className="bucuria-status-buttons">{statuses.map(status=><button key={status} className={campaign?.status===status?'active':''} onClick={()=>changeStatus(status)} disabled={busy}>{labels[status]}</button>)}</div>
    </section>
    <section className="bucuria-page-card">
      <div className="bucuria-page-title"><div><span>COMENZI COLEGI</span><h2>{orders.length} comenzi</h2></div></div>
      <div className="bucuria-orders-list">{orders.length===0?<p>Nu sunt comenzi încă.</p>:orders.map(order=><article key={order.id}><div><strong>{order.userName}</strong><small>{order.phone||'Fără telefon'} · {order.items.length} poziții</small></div><b>{money(order.total)}</b></article>)}</div>
    </section>
    <section className="bucuria-page-card">
      <div className="bucuria-page-title"><div><span>CENTRALIZARE</span><h2>Total pe produs</h2></div></div>
      <div className="bucuria-summary-list">{summary.length===0?<p>Centralizarea va apărea după primele comenzi.</p>:summary.map((item,index)=><div key={`${item.name}-${index}`}><div><strong>{item.name}</strong><small>{item.barcode||'fără cod'}</small></div><span>{item.qty.toLocaleString('ro-MD',{maximumFractionDigits:2})} {item.unit||'buc'}</span><b>{money(item.total)}</b></div>)}</div>
    </section>
  </main>;
}
