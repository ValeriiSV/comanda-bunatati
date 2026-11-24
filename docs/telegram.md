# Telegram — Bunătăți Manager
1. Creează botul în @BotFather cu /newbot.
2. În Cloudflare Pages → comanda-bunatati → Settings → Variables and Secrets (Production), adaugă TELEGRAM_BOT_TOKEN (secret) și TELEGRAM_WEBHOOK_SECRET (secret, 32–256 caractere alfanumerice, _ sau -, generat aleator). Nu pune tokenul în GitHub sau în chat.
3. Publică din nou aplicația dacă setările o cer, apoi autentifică-te în Manager → Setări → Conectează botul.
4. Deschide botul privat și trimite /id. Configurează TELEGRAM_ADMIN_CHAT_ID (ID numeric) în Cloudflare Production și republică dacă este necesar.
5. În Manager apasă Trimite test. /admin și /sumar răspund numai în chatul autorizat.
6. /sumar citește ultima statistică publică, nu solduri individuale. Botul nu trimite automat notificări despre comenzi în această versiune.
