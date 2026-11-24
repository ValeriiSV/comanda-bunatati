export type Env = { TELEGRAM_BOT_TOKEN?: string; TELEGRAM_WEBHOOK_SECRET?: string; TELEGRAM_ADMIN_CHAT_ID?: string };
export const SITE='https://comanda-bunatati.pages.dev';
export const FIREBASE_API_KEY="AIzaSyDu86lUJXgQYTkbNQlLX3bIFd5ht3_PWoY";
export const FIRESTORE='https://firestore.googleapis.com/v1/projects/comanda-bunatati/databases/(default)/documents';
export const ADMIN_EMAIL='valerkasvetlicenco@icloud.com';
export function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8','Cache-Control':'no-store'}});}
export function configured(env:Env){return !!env.TELEGRAM_BOT_TOKEN && /^[A-Za-z0-9_-]{32,256}$/.test(env.TELEGRAM_WEBHOOK_SECRET||'');}
export async function telegram(env:Env,method:string,body:Record<string,unknown>={}){
 if(!env.TELEGRAM_BOT_TOKEN)throw new Error('Tokenul botului nu este configurat.');
 const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const data=await response.json() as {ok?:boolean;result?:any;error_code?:number};
 if(!response.ok||!data.ok)throw new Error('Telegram nu a acceptat operațiunea (cod '+(data.error_code||response.status)+').');
 return data.result;
}
export async function adminAuthorized(request:Request){
 const auth=request.headers.get('Authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>10000)return false;
 try{
 const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(FIREBASE_API_KEY),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:auth.slice(7)}),signal:AbortSignal.timeout(10000)});
 const data=await response.json() as {users?:{email?:string;disabled?:boolean}[]};
 return response.ok&&data.users?.length===1&&data.users[0].email===ADMIN_EMAIL&&data.users[0].disabled!==true;
 }catch{return false;}
}
