# HasiScan

Belge ve QR tarayıcı — **Hasi Elektronic**, Vaihingen/Enz.

Belgeleri kamera veya galeriden tara, kırp, netleştir, PDF kaydet, metin tanı. Taramalar cihazda kalır (IndexedDB). Hesap yok, sunucu veritabanı yok.

## Adresler

- Kaynak: [github.com/hasi-elektronic/hasiscan](https://github.com/hasi-elektronic/hasiscan)
- Canlı (Cloudflare Pages): [hasiscan.pages.dev](https://hasiscan.pages.dev)

## Kullanım

- **Web:** canlı adresi tarayıcıda aç
- **iPhone:** Safari → Paylaş → Ana Ekrana Ekle
- **Android:** Chrome’dan yükle veya `public/native/HasiScan.apk`

## Yayın

`main` dalına her push Cloudflare Pages projesine (`hasiscan`) gider. GitHub Actions sırları:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

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
