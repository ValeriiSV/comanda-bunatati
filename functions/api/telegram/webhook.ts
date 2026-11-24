import {configured,json,telegram,SITE,FIRESTORE,FIREBASE_API_KEY,type Env} from './_shared';
type Update={message?:{text?:string;chat?:{id?:number;type?:string}}};
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 if(!configured(env))return json({ok:false},503);
 if(request.headers.get('X-Telegram-Bot-Api-Secret-Token')!==env.TELEGRAM_WEBHOOK_SECRET)return json({ok:false},403);
 let update:Update;try{update=await request.json();}catch{return json({ok:false},400);}
 const msg=update.message,chat=msg?.chat;if(chat?.type!=='private'||!Number.isSafeInteger(chat.id)||typeof msg?.text!=='string')return json({ok:true});
 const id=String(chat.id),isAdmin=id===env.TELEGRAM_ADMIN_CHAT_ID;
 const cmd=msg.text.trim().split(/\s+/)[0].split('@')[0].toLowerCase();
 const publicButtons=[[{text:'🛒 Deschide catalogul',url:SITE+'/'}],[{text:'📦 Verifică starea comenzii',url:SITE+'/status'}]];
 const adminButtons=[[{text:'📊 Manager',url:SITE+'/admin'},{text:'📋 Comenzi',url:SITE+'/admin/comenzi'}],[{text:'💳 Plăți',url:SITE+'/admin/plati'},{text:'📦 Ridicare',url:SITE+'/admin/pregatire'}],[{text:'📈 Finanțe',url:SITE+'/admin/finante'}]];
 let text='Bunătăți împreună cu Valera 🥜\nAlege catalogul sau verifică starea comenzii.';
 let buttons=isAdmin?[...publicButtons,...adminButtons]:publicButtons;
 if(cmd==='/id'){text='ID-ul conversației tale: '+id;buttons=[];}
 else if(cmd==='/admin'){text=isAdmin?'Bunătăți Manager — acces rapid. Autentificarea rămâne obligatorie.':'Accesul Manager este disponibil doar administratorului.';buttons=isAdmin?adminButtons:publicButtons;}
 else if(cmd==='/comanda'){text='Deschide catalogul pentru a trimite o comandă.';buttons=publicButtons;}
 else if(cmd==='/status'){text='Deschide pagina de verificare și introdu codul comenzii.';buttons=[publicButtons[1]];}
 else if(cmd==='/sumar'){
   if(!isAdmin){text='Comanda este disponibilă doar administratorului.';buttons=[];}
   else{
     try{const res=await fetch(FIRESTORE+'/settings/publicStats?key='+encodeURIComponent(FIREBASE_API_KEY),{signal:AbortSignal.timeout(8000)});
     if(!res.ok)throw Error();const data=await res.json() as {fields?:Record<string,{stringValue?:string;integerValue?:string;timestampValue?:string}>};const f=data.fields||{};
     const n=(key:string)=>Number(f[key]?.integerValue||0);
     const lei=(n('totalBani')/100).toLocaleString('ro-MD',{maximumFractionDigits:2});
     text='Ultima statistică publicată\n'+(f.roundLabel?.stringValue||'Runda curentă')+'\nComenzi: '+n('orderCount')+'\nValoare produse înainte de reduceri: '+lei+' lei\nComenzi achitate integral: '+n('paidCount')+'\nActualizat: '+(f.updatedAt?.timestampValue?new Date(f.updatedAt.timestampValue).toLocaleString('ro-MD',{timeZone:'Europe/Chisinau'}):'necunoscut')+'\nPentru date actuale deschide Manager.';
     }catch{text='Statistica nu este disponibilă momentan. Deschide Manager.';}buttons=adminButtons;
   }
 }
 else if(cmd==='/start'||cmd==='/help'){text+='\nComenzi: /comanda, /status, /id'+(isAdmin?', /admin, /sumar':'');}
 else{return json({ok:true});}
 try{await telegram(env,'sendMessage',{chat_id:chat.id,text,...(buttons.length?{reply_markup:{inline_keyboard:buttons}}:{})});return json({ok:true});}catch{return json({ok:false},502);}
}
