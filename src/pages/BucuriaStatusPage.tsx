import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { BucuriaLogo } from '@/components/BrandLogos';
import './bucuria-admin-pages.css';

type Campaign={status?:string;title?:string};
type OrderItem={name:string;pack?:string;price:number;qty:number;unit?:string};
type Order={userName:string;phone?:string;items:OrderItem[];total:number;status:string;updatedAt?:any};

const money=(v:number)=>new Intl.NumberFormat('ro-MD',{style:'currency',currency:'MDL',maximumFractionDigits:2}).format(v||0);
const labels:Record<string,string>={draft:'În pregătire',open:'Deschisă',closed:'Închisă',sent:'Trimisă furnizorului',received:'Primită',distributed:'Distribuită'};

export default function BucuriaStatusPage(){
  const [user,setUser]=useState<User|null>(auth.currentUser);
  const [campaign,setCampaign]=useState<Campaign|null>(null);
  const [order,setOrder]=useState<Order|null>(null);
  const [message,setMessage]=useState('');

  useEffect(()=>onAuthStateChanged(auth,next=>setUser(next)),[]);
  useEffect(()=>{
    if(!user)return;
    const stopCampaign=onSnapshot(doc(db,'groupCampaigns','bucuria'),snap=>setCampaign(snap.exists()?snap.data() as Campaign:null),e=>setMessage(e.message));
    const stopOrder=onSnapshot(doc(db,'groupCampaigns','bucuria','orders',user.uid),snap=>setOrder(snap.exists()?snap.data() as Order:null),e=>setMessage(e.message));
    return()=>{stopCampaign();stopOrder();};
  },[user]);

  if(!user)return <main className="bucuria-page-shell"><section className="bucuria-page-card empty"><PackageCheck size={40}/><h1>Status Bucuria</h1><p>Autentifică-te în Orbico Market pentru a vedea comanda.</p><Link to="/">Orbico Market</Link></section></main>;

  return <main className="bucuria-page-shell">
    <header className="bucuria-page-head"><Link to="/bucuria"><ArrowLeft size={18}/> Bucuria</Link><div className="bucuria-head-brand"><BucuriaLogo className="bucuria-head-logo" /><div><span>ORBICO MARKET · BUCURIA</span><h1>Statusul comenzii</h1></div></div></header>
    {message&&<div className="bucuria-page-message">{message}</div>}
    <section className="bucuria-status-overview bucuria-page-card">
      <div><span>Campanie</span><strong>{labels[campaign?.status||'draft']||campaign?.status||'—'}</strong></div>
      <div><span>Comanda ta</span><strong>{order?'Salvată':'Nu este trimisă'}</strong></div>
      <div><span>Total</span><strong>{order?money(order.total):'—'}</strong></div>
    </section>
    {!order?<section className="bucuria-page-card empty"><PackageCheck size={42}/><h2>Nu ai o comandă Bucuria</h2><p>Alege produsele dorite și trimite comanda cât timp campania este deschisă.</p><Link to="/bucuria">Deschide catalogul</Link></section>:
    <section className="bucuria-page-card">
      <div className="bucuria-page-title"><div><span>COMANDA TA</span><h2>{order.userName}</h2><p>{order.phone||'Fără telefon'}</p></div><CheckCircle2 size={28}/></div>
      <div className="bucuria-status-items">{order.items.map((item,index)=><div key={`${item.name}-${index}`}><div><strong>{item.name}</strong><small>{item.pack||item.unit||'buc'}</small></div><span>{item.qty} {item.unit||'buc'}</span><b>{money(item.price*item.qty)}</b></div>)}</div>
      <div className="bucuria-status-total"><span>Total comandă</span><strong>{money(order.total)}</strong></div>
    </section>}
  </main>;
}
