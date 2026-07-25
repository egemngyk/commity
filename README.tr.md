# Commity

> TASKS.md uzerindeki tamamlanan gorevleri analiz ederek veya projede bir gorev dosyasi yoksa dogrudan kod degisikliklerini (git diff) inceleyerek otomatik olarak Conventional Commit mesajlari ureten VS Code ve Antigravity IDE uyumlu yapay zeka eklentisi.

[README.md](./README.md) (English) | Turkce dokumantasyon

![Commity Ikonu](icons/commity.png)

## Ozellikler

- **Tamamlanan Gorevleri Algilama** - `TASKS.md` uzerindeki `git diff HEAD` sonucunu analiz ederek sadece `[ ]` durumundan `[x]` durumuna gecen satirlari yakalar.
- **Git Diff Modu (Sifir Yapilandirma)** - Calisma alaninda herhangi bir gorev/todo dosyasi yoksa, Commity otomatik olarak staged + unstaged kod degisikliklerini dosya isimleriyle birlikte toplar ve AI'dan bu degisikliklere gore commit mesaji uretmesini ister.
- **OpenRouter Destegi** - OpenRouter entegrasyonu sayesinde (varsayilan olarak `openrouter/auto` modeliyle), tek bir API anahtari ile yuzlerce yapay zeka modeline erisebilirsiniz.
- **Yapay Zeka Destekli Commit Mesajlari** - Antigravity veya Copilot chat paneline otomatik prompt gonderir. Sohbet paneli yoksa `vscode.lm`, OpenRouter veya OpenAI uyumlu HTTP endpoint fallback zincirini calistirir.
- **Onay ve Calistirma** - Eklenti kendi basina onay almadan commit atmaz. Onizleme ekraninda git komutlarini ve hangi AI saglayicisinin kullanildigini gosteren bir badge gosterir.
- **Duzenlenebilir Arayuz** - AI'in urettigi commit mesajini terminalde calistirmadan once webview uzerinde duzenleyebilirsiniz.
- **Yeniden Uretme (Regenerate)** - Begenmediginiz commit mesajlarini tek butonla yeniden uretebilirsiniz.
- **VS Code Temasiyla Uyumlu** - Arayuz tamamen VS Code renk paletine (koyu/acik tema) uyum saglar.

## Calisma Mantigi

```
Ctrl+Shift+P -> "Commity: Generate Commit Message"
       |
       v
1. Git repo kokunu tespit eder
2. TASKS.md (veya tasks.md / Todo.md / TODO.md) dosyasini arar
       |
       +-- Gorev Dosyasi Bulundu mu?
       |     +-- HEAD commit'ine kiyasla [ ] -> [x] gecislerini ayiklar
       |
       +-- Gorev Dosyasi Yok mu?
             +-- Git Diff Moduna Gecer: Degisen tum kod satirlarini ve dosya adlarini toplar
       |
       v
3. Toplanan gorev/degisikliklerle AI prompt'unu olusturur
       |
       +-- Antigravity / Copilot chat paneli varsa
       |     +-- Prompt'u chat paneline yazar -> AI yaniti orada uretilir
       |
       +-- Chat paneli yoksa
             +-- vscode.lm API -> dogrudan mesaji uretir
             +-- OpenRouter API -> dogrudan mesaji uretir
             +-- OpenAI uyumlu API -> dogrudan mesaji uretir
             +-- Mock (Gelistirici modu) -> ornek mesaj doner
       |
       v
4. Arayuzde onay paneli acilir (kullanilan AI saglayici badge'i ile):
    +------------------------------------------+
    |  feat(engine): implement physics engine   | <- Duzenlenebilir
    |                                           |
    |  [Antigravity AI Agent]                   | <- Saglayici badge'i
    |                                           |
    |  git add .                                |
    |  git commit -m "feat(engine): implement..." |
    |                                           |
    |  [Terminalde Calistir] [Kopyala]          |
    +------------------------------------------+
```

## Kurulum

### VSIX Dosyasindan Manuel Kurulum
```bash
git clone https://github.com/egemngyk/commity.git
cd commity
npm install
npm run compile
npx vsce package
# Sonrasinda VS Code/Antigravity uzerinde: Uzantilar (Extensions) -> ... -> Install from VSIX
```

### Gelistirici Modunda Test Etme (F5)
```bash
git clone https://github.com/egemngyk/commity.git
cd commity
npm install
# Projeyi VS Code / Antigravity ile acin
# F5 tusuna basin -> Yeni test penceresi acilacaktir
```

## Gereksinimler

- VS Code `^1.85.0` veya Antigravity IDE
- Bir Git reposu (dosya degisiklikleri yapilmis veya gorev listesi dosyasi iceren)
- Yapay zeka ozellikleri icin asagidakilerden biri:
  - Antigravity IDE (Dahili yapay zeka sohbet paneli uzerinden)
  - GitHub Copilot Chat eklentisi
  - OpenRouter API anahtari (veya uyumlu bir API endpoint)
  - OpenAI API Key (veya uyumlu bir API endpoint)
  - Ollama / LM Studio (Yerel modeller icin, API anahtari gerekmez)

## Ayarlar

| Ayar | Varsayilan | Aciklama |
|---|---|---|
| `commity.preferredProvider` | `"auto"` | `auto` / `chat` / `vscode-lm` / `openai` / `openrouter` / `mock` |
| `commity.openrouterApiKey` | `""` | OpenRouter API anahtari |
| `commity.openrouterModel` | `"openrouter/auto"` | OpenRouter model ID'si |
| `commity.openaiApiKey` | `""` | OpenAI veya uyumlu API anahtari |
| `commity.openaiBaseUrl` | `"https://api.openai.com/v1"` | API endpoint adresi (Ollama, LM Studio vb. destekler) |
| `commity.model` | `"gpt-4o"` | OpenAI saglayicisi icin model adi |
| `commity.temperature` | `0.3` | Yaraticilik orani (0-2) |
| `commity.conventionalCommitStyle` | `true` | Kuralli commit formatini zorunlu kilar (`feat/fix/chore...`) |
| `commity.promptTemplate` | `""` | Ozel prompt sablonu. `{tasks}` veya `{diff}` yer tutucusunu kullanin |
| `commity.preferredTasksFilename` | `""` | Otomatik dosya taramayi bypass edip sabit bir dosya secer |
| `commity.autoCopy` | `false` | Uretilen komutlari otomatik olarak panoya kopyalar |
| `commity.maxRetries` | `3` | AI gecersiz format urettiginde yapilacak maksimum deneme sayisi |

## TASKS.md Formati

Eger bir gorev listesi dosyasi kullanmayi tercih ederseniz, Commity standart gorev listelerini okur:

```markdown
## Sprint 3

- [x] Fizik motorunu yaz            <- Algilanir (onceden secilmemisti)
- [x] Carpisma sistemini entegre et <- Algilanir
- [ ] Coklu oyuncu destegi ekle     <- Pas gecilir (tamamlanmamis)
- [x] Zaten onceden tamamlanmisti   <- Pas gecilir (HEAD commit'inde zaten [x] durumundaydi)
```

Sadece bu commit icerisinde `[ ]` durumundan `[x]` durumuna gecen satirlar dikkate alinir.

## Lisans

Bu proje MIT Lisansi ile lisanslanmistir - detaylar icin [LICENSE](./LICENSE) dosyasina goz atabilirsiniz.

MIT (c) 2026 Muhammed Egemen Geyik
