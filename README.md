# HasiScan

Belge ve QR tarayıcı — **Hasi Elektronic**, Vaihingen/Enz.

Belgeleri kamera veya galeriden tara, kırp, netleştir, PDF kaydet, metin tanı. Taramalar cihazda kalır (IndexedDB). Hesap yok, sunucu veritabanı yok.

## Adresler

- Kaynak: [github.com/hasi-elektronic/hasiscan](https://github.com/hasi-elektronic/hasiscan)
- Canlı: [hasiscan.vercel.app](https://hasiscan.vercel.app)
- Cloudflare Pages: `hasiscan.pages.dev` — GitHub Actions `CLOUDFLARE_API_TOKEN` ve `CLOUDFLARE_ACCOUNT_ID` sırları eklenince yayınlanır

## Kullanım

- **Web:** canlı adresi tarayıcıda aç
- **iPhone:** Safari → Paylaş → Ana Ekrana Ekle
- **Android:** Chrome’dan yükle veya `public/native/HasiScan.apk`

## Yayın

`main` dalına her push hem Vercel üretimine hem Cloudflare Pages işine gider.

Cloudflare için GitHub → Settings → Secrets and variables → Actions:

- `CLOUDFLARE_API_TOKEN` (diğer Hasi sitelerindeki aynı token)
- `CLOUDFLARE_ACCOUNT_ID` (`ac6ab4ce1149a3591d014841856490af`)

Sonra Actions’tan **Deploy Cloudflare Pages** işini yeniden çalıştır.

## Geliştirme

```bash
npm install
npm run dev
```

```bash
npm run typecheck
npm run build
```

Cloudflare çıktısı için:

```bash
NITRO_PRESET=cloudflare_pages npm run build
```

## Marka

Hasi Elektronic · Grabenstraße 18, 71665 Vaihingen/Enz · [hasi-elektronic.de](https://hasi-elektronic.de)
