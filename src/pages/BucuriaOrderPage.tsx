import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { ArrowLeft, CheckCircle2, Minus, Plus, Search, ShoppingBag, SlidersHorizontal } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { bucuriaPhotoCatalog } from '@/lib/bucuriaPhotoCatalog';
import './bucuria-order.css';

type Profile={uid:string;email:string;displayName:string;phone?:string;approved:boolean;blocked?:boolean;role:'admin'|'user'};
type Status='draft'|'open'|'closed'|'sent'|'received'|'distributed';
type Campaign={id:string;title:string;supplier:string;status:Status;notes?:string;deadline?:string};
type Product={id:string;barcode?:string;name:string;pack?:string;price:number;category?:string;unit?:'buc'|'kg';step?:number};
type OrderItem={productId:string;barcode?:string;name:string;pack?:string;price:number;qty:number;unit?:'buc'|'kg'};
type Order={id:string;userId:string;userName:string;phone?:string;items:OrderItem[];total:number;status:'submitted'};

const ADMIN_EMAIL='valerkasvetlicenco@icloud.com';
const statusLabel:Record<Status,string>={draft:'În pregătire',open:'Deschisă',closed:'Închisă',sent:'Trimisă',received:'Primită',distributed:'Distribuită'};
const money=(v:number)=>new Intl.NumberFormat('ro-MD',{style:'currency',currency:'MDL',maximumFractionDigits:2}).format(v||0);
const safeId=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
const round=(value:number)=>Math.round(value*1000)/1000;

export default function BucuriaOrderPage(){
  const [user,setUser]=useState<User|null>(auth.currentUser);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [campaign,setCampaign]=useState<Campaign|null>(null);
  const [products,setProducts]=useState<Product[]>([]);
  const [myOrder,setMyOrder]=useState<Order|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [qty,setQty]=useState<Record<string,number>>({});
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('Toate');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const approved=profile?.approved===true&&profile?.blocked!==true;
  const isAdmin=profile?.role==='admin'||user?.email?.toLowerCase()===ADMIN_EMAIL;

  useEffect(()=>onAuthStateChanged(auth,async next=>{
    setUser(next);setProfile(null);
    if(!next)return;
    try{const snap=await getDoc(doc(db,'marketUsers',next.uid));if(snap.exists())setProfile(snap.data() as Profile);}catch(e){setMessage((e as Error).message);}
  }),[]);

  useEffect(()=>{
    if(!approved)return;
    return onSnapshot(doc(db,'groupCampaigns','bucuria'),snap=>setCampaign(snap.exists()?({id:snap.id,...snap.data()} as Campaign):null),e=>setMessage(e.message));
  },[approved]);

  useEffect(()=>{
    if(!approved)return;
    return onSnapshot(collection(db,'groupCampaigns','bucuria','products'),snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()} as Product)).sort((a,b)=>a.name.localeCompare(b.name,'ro'));
      setProducts(list);
    },e=>setMessage(e.message));
  },[approved]);

  useEffect(()=>{
    if(!approved||!user)return;
    if(isAdmin){
      return onSnapshot(collection(db,'groupCampaigns','bucuria','orders'),snap=>{
        const list=snap.docs.map(d=>({id:d.id,...d.data()} as Order));setOrders(list);
        const mine=list.find(o=>o.userId===user.uid)||null;setMyOrder(mine);
        if(mine)setQty(Object.fromEntries(mine.items.map(i=>[i.productId,i.qty])));
      });
    }
    return onSnapshot(doc(db,'groupCampaigns','bucuria','orders',user.uid),snap=>{
      if(!snap.exists()){setMyOrder(null);return;}
      const order={id:snap.id,...snap.data()} as Order;setMyOrder(order);setQty(Object.fromEntries(order.items.map(i=>[i.productId,i.qty])));
    });
  },[approved,user,isAdmin]);

  const categories=useMemo(()=>['Toate',...Array.from(new Set(products.map(p=>p.category).filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'ro'))],[products]);
  const visible=useMemo(()=>products.filter(p=>{
    const okCategory=category==='Toate'||p.category===category;
    const needle=search.trim().toLowerCase();
    const okSearch=!needle||`${p.name} ${p.barcode||''} ${p.pack||''}`.toLowerCase().includes(needle);
    return okCategory&&okSearch;
  }),[products,category,search]);

  const selectedItems=useMemo(()=>products.map(p=>({product:p,qty:Number(qty[p.id]||0)})).filter(x=>x.qty>0),[products,qty]);
  const total=selectedItems.reduce((sum,x)=>sum+x.product.price*x.qty,0);
  const itemCount=selectedItems.length;

  const changeQty=(product:Product,delta:number)=>{
    const step=Number(product.step||((product.unit||'buc')==='kg'?0.1:1));
    setQty(current=>({...current,[product.id]:Math.max(0,round(Number(current[product.id]||0)+delta*step))}));
  };

  const createCampaign=async()=>{
    if(!isAdmin)return;setBusy(true);
    try{await setDoc(doc(db,'groupCampaigns','bucuria'),{title:'Bucuria – Dulciuri',supplier:'SOLDI SRL / SA Bucuria',status:'draft',notes:'Catalog provizoriu din lista foto. Prețurile se reconfirmă la primirea Excelului oficial.',createdAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});setMessage('Campania Bucuria este pregătită.');}finally{setBusy(false);}
  };

  const seedCatalog=async()=>{
    if(!isAdmin)return;setBusy(true);
    try{
      const existing=await new Promise<any[]>((resolve,reject)=>{const stop=onSnapshot(collection(db,'groupCampaigns','bucuria','products'),s=>{stop();resolve(s.docs);},reject)});
      if(existing.length){const del=writeBatch(db);existing.forEach(d=>del.delete(d.ref));await del.commit();}
      const batch=writeBatch(db);
      bucuriaPhotoCatalog.forEach((p,index)=>{
        const id=safeId(`${p.barcode||'fara-cod'}-${p.name}-${p.pack||''}-${index}`);
        batch.set(doc(db,'groupCampaigns','bucuria','products',id),{...p,source:'photo-list-2025',updatedAt:serverTimestamp()});
      });
      await batch.commit();setMessage(`${bucuriaPhotoCatalog.length} poziții Bucuria au fost încărcate.`);
    }catch(e){setMessage(`Catalogul nu a putut fi încărcat: ${(e as Error).message}`);}finally{setBusy(false);}
  };

  const setStatus=async(status:Status)=>{if(!isAdmin)return;setBusy(true);try{await setDoc(doc(db,'groupCampaigns','bucuria'),{status,updatedAt:serverTimestamp()},{merge:true});}finally{setBusy(false);}};

  const submit=async()=>{
    if(!user||!profile||campaign?.status!=='open')return;
    const items:OrderItem[]=selectedItems.map(({product,qty})=>({productId:product.id,barcode:product.barcode||'',name:product.name,pack:product.pack||'',price:product.price,qty,unit:product.unit||'buc'}));
    if(!items.length){setMessage('Adaugă cel puțin un produs în comandă.');return;}
    setBusy(true);
    try{await setDoc(doc(db,'groupCampaigns','bucuria','orders',user.uid),{userId:user.uid,userName:profile.displayName,phone:profile.phone||'',items,total,status:'submitted',updatedAt:serverTimestamp()});setMessage(myOrder?'Comanda a fost actualizată.':'Comanda a fost trimisă.');}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
  };

  if(!user)return <main className="bucuria-shell"><section className="bucuria-empty"><h1>Bucuria – Dulciuri</h1><p>Autentifică-te în Orbico Market pentru a participa.</p><Link to="/">Orbico Market</Link></section></main>;
  if(!approved)return <main className="bucuria-shell"><section className="bucuria-empty"><h1>Cont în așteptare</h1><p>Comenzile comune sunt disponibile după aprobarea contului.</p><Link to="/">Orbico Market</Link></section></main>;

  return <main className="bucuria-shell">
    <header className="bucuria-topbar">
      <Link to="/comenzi-comune" className="bucuria-back"><ArrowLeft size={18}/> Comenzi comune</Link>
      <div><span>ORBICO MARKET · INTERN</span><h1>Bucuria – Dulciuri</h1></div>
    </header>

    {message&&<button className="bucuria-message" onClick={()=>setMessage('')}>{message}</button>}

    {!campaign&&isAdmin&&<section className="bucuria-empty compact"><h2>Creează campania Bucuria</h2><button className="bucuria-primary" onClick={createCampaign} disabled={busy}>Creează</button></section>}

    {campaign&&<>
      <section className="bucuria-hero">
        <div><span className="bucuria-eyebrow">SOLDI SRL / SA BUCURIA</span><h2>Dulciuri pentru comanda comună</h2><p>Catalog compact, fără imagini. Alege cantitatea și totalul se calculează automat.</p></div>
        <div className={`bucuria-status status-${campaign.status}`}>{statusLabel[campaign.status]}</div>
      </section>

      {isAdmin&&<details className="bucuria-admin"><summary><SlidersHorizontal size={17}/> Administrare Bucuria</summary><div className="bucuria-admin-body">
        <div className="admin-actions"><button onClick={seedCatalog} disabled={busy}>Actualizează pozițiile din poze ({bucuriaPhotoCatalog.length})</button>{(['draft','open','closed','sent','received','distributed'] as Status[]).map(s=><button key={s} className={campaign.status===s?'active':''} onClick={()=>setStatus(s)} disabled={busy}>{statusLabel[s]}</button>)}</div>
        <div className="admin-stats-line"><span>{products.length} produse</span><span>{orders.length} comenzi</span><span>{money(orders.reduce((s,o)=>s+Number(o.total||0),0))} total</span></div>
      </div></details>}

      <section className="bucuria-tools">
        <label className="bucuria-search"><Search size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Caută produs sau cod de bare..."/></label>
        <div className="bucuria-categories">{categories.map(c=><button key={c} className={category===c?'active':''} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      </section>

      {products.length===0?<section className="bucuria-empty compact"><ShoppingBag size={38}/><h2>Catalogul este gol</h2><p>{isAdmin?'Deschide Administrare Bucuria și încarcă pozițiile din poze.':'Catalogul va fi publicat de administrator.'}</p></section>:
      <section className="bucuria-list" aria-label="Catalog Bucuria">
        {visible.map(product=>{
          const unit=product.unit||'buc';const current=Number(qty[product.id]||0);const subtotal=current*product.price;
          return <article className={`bucuria-row ${current>0?'selected':''}`} key={product.id}>
            <div className="bucuria-row-main"><span>{product.category||'Bucuria'}</span><h3>{product.name}</h3><small>{product.pack|| (unit==='kg'?'vrac':'bucată')} {product.barcode?`· ${product.barcode}`:''}</small></div>
            <div className="bucuria-price"><strong>{money(product.price)}</strong><small>/ {unit}</small></div>
            <div className="bucuria-qty"><button onClick={()=>changeQty(product,-1)} aria-label={`Scade ${product.name}`}><Minus size={16}/></button><b>{current?current.toLocaleString('ro-MD',{maximumFractionDigits:2}):'0'}</b><button onClick={()=>changeQty(product,1)} aria-label={`Adaugă ${product.name}`}><Plus size={16}/></button></div>
            <div className="bucuria-subtotal"><small>Subtotal</small><strong>{subtotal>0?money(subtotal):'—'}</strong></div>
          </article>;
        })}
      </section>}

      <div className="bucuria-cartbar">
        <div><span>{itemCount} {itemCount===1?'poziție':'poziții'} selectate</span><strong>{money(total)}</strong>{myOrder&&<small><CheckCircle2 size={14}/> Ai o comandă salvată</small>}</div>
        <button onClick={submit} disabled={busy||campaign.status!=='open'||itemCount===0}>{campaign.status!=='open'?'Comanda nu este deschisă':myOrder?'Actualizează comanda':'Trimite comanda'}</button>
      </div>
    </>}
  </main>;
}
