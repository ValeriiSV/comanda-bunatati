import {adminAuthorized,configured,json,telegram,SITE,type Env} from './_shared';
export async function onRequestPost({request,env}:{request:Request;env:Env}){
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'Cerere neautorizată.'},403);
 if(!await adminAuthorized(request))return json({error:'Autentificare administrator necesară.'},403);
 let body:{action?:string};try{body=await request.json();}catch{return json({error:'Cerere invalidă.'},400);}
 if(!configured(env))return json({configured:false,error:'Configurează TELEGRAM_BOT_TOKEN și TELEGRAM_WEBHOOK_SECRET în Cloudflare.'},503);
 const adminConfigured=/^\d+$/.test(env.TELEGRAM_ADMIN_CHAT_ID||'');
 try{
 if(body.action==='connect'){
   await telegram(env,'setWebhook',{url:SITE+'/api/telegram/webhook',secret_token:env.TELEGRAM_WEBHOOK_SECRET,allowed_updates:['message']});
   await telegram(env,'setMyCommands',{commands:[{command:'start',description:'Meniu'},{command:'comanda',description:'Catalog produse'},{command:'status',description:'Stare comandă'},{command:'id',description:'ID conversație'}]});
 }
 else if(body.action==='test'){
   if(!adminConfigured)return json({error:'Configurează TELEGRAM_ADMIN_CHAT_ID mai întâi.'},400);
   await telegram(env,'sendMessage',{chat_id:env.TELEGRAM_ADMIN_CHAT_ID,text:'✅ Bunătăți Manager — test Telegram reușit.'});
 }else if(body.action!=='status')return json({error:'Acțiune invalidă.'},400);
 const [me,info]=await Promise.all([telegram(env,'getMe'),telegram(env,'getWebhookInfo')]);
 return json({configured:true,connected:info?.url===SITE+'/api/telegram/webhook',username:me?.username||'',adminConfigured,pending:info?.pending_update_count||0,tested:body.action==='test'});
 }catch(e){return json({error:e instanceof Error?e.message:'Operațiunea Telegram a eșuat.'},502);}
}
