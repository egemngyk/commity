# Commity

> 🤖 `TASKS.md` üzerindeki tamamlanan görevleri analiz ederek veya projede bir görev dosyası yoksa doğrudan kod değişikliklerini (git diff) inceleyerek otomatik olarak Conventional Commit (Kurallı Commit) mesajları üreten VS Code ve Antigravity IDE uyumlu yapay zeka eklentisi. Works with Antigravity IDE, GitHub Copilot, OpenRouter, and OpenAI-compatible APIs.

🇬🇧 **[README.md](./README.md) (English)** | 🇹🇷 **Türkçe dökümantasyon**

![Commity İkonu](icons/commity.png)

## Özellikler

- ✅ **Tamamlanan Görevleri Algılama** — `TASKS.md` üzerindeki `git diff HEAD` sonucunu analiz ederek sadece `[ ]` (yapılacak) durumundan `[x]` (tamamlandı) durumuna geçen satırları yakalar.
- 🔍 **Git Diff Modu (Sıfır Yapılandırma)** — Çalışma alanında herhangi bir görev/todo dosyası yoksa, Commity otomatik olarak staged + unstaged kod değişikliklerini dosya isimleriyle birlikte toplar ve AI'dan bu değişikliklere göre commit mesajı üretmesini ister.
- 🌐 **OpenRouter Desteği** — OpenRouter entegrasyonu sayesinde (varsayılan olarak `openrouter/auto` modeliyle), tek bir API anahtarı ile yüzlerce yapay zeka modeline (GPT-4o, Claude 3.5, Gemini, Llama) erişebilirsiniz.
- 🤖 **Yapay Zeka Destekli Commit Mesajları** — Antigravity veya Copilot chat paneline otomatik prompt gönderir. Sohbet paneli yoksa `vscode.lm` (VS Code Dil Modeli API'si), OpenRouter veya OpenAI uyumlu HTTP endpoint fallback zincirini çalıştırır.
- 📋 **Onay ve Çalıştırma** — Eklenti kendi başına onay almadan commit atmaz. Önizleme ekranında `git add . && git commit -m "..."` komutlarını ve hangi AI sağlayıcısının kullanıldığını gösteren bir badge görüntüler, tek tıkla entegre terminalde çalıştırmanıza olanak tanır.
- ✏️ **Düzenlenebilir Arayüz** — AI'ın ürettiği commit mesajını terminalde çalıştırmadan önce webview üzerinde düzenleyebilirsiniz.
- 🔄 **Yeniden Üretme (Regenerate)** — Beğenmediğiniz commit mesajlarını tek butonla yeniden üretebilirsiniz.
- 🎨 **VS Code Temasıyla Uyumlu** — Arayüz tamamen VS Code renk paletine (koyu/açık tema) uyum sağlar.

## Çalışma Mantığı

```
Ctrl+Shift+P → "Commity: Generate Commit Message"
       │
       ▼
1. Git repo kökünü tespit eder
2. TASKS.md (veya tasks.md / Todo.md / TODO.md) dosyasını arar
       │
       ├─ Görev Dosyası Bulundu mu?
       │     └─ HEAD commit'ine kıyasla [ ] -> [x] geçişlerini ayıklar
       │
       └─ Görev Dosyası Yok mu?
             └─ Git Diff Moduna Geçer: Değişen tüm kod satırlarını ve dosya adlarını toplar
       │
       ▼
3. Toplanan görev/değişikliklerle AI prompt'unu oluşturur
       │
       ├─ Antigravity / Copilot chat paneli varsa
       │     └─ Prompt'u chat paneline yazar → AI yanıtı orada üretilir
       │
       └─ Chat paneli yoksa
             ├─ vscode.lm API → doğrudan mesajı üretir
             ├─ OpenRouter API → doğrudan mesajı üretir
             ├─ OpenAI uyumlu API → doğrudan mesajı üretir
             └─ Mock (Geliştirici modu) → örnek mesaj döner
       │
       ▼
4. Arayüzde onay paneli açılır (kullanılan AI sağlayıcı badge'i ile):
    ┌──────────────────────────────────────────┐
    │  feat(engine): implement physics engine   │ ← Düzenlenebilir
    │                                           │
    │  [💬 Antigravity AI Agent]                │ ← Sağlayıcı badge'i
    │                                           │
    │  git add .                                │
    │  git commit -m "feat(engine): implement..." │
    │                                           │
    │  [▶ Terminalde Çalıştır] [📋 Kopyala]      │
    └──────────────────────────────────────────┘
```

## Kurulum

### VSIX Dosyasından Manuel Kurulum
```bash
git clone https://github.com/kullanici_adin/commity.git
cd commity
npm install
npm run compile
npx vsce package
# Sonrasında VS Code/Antigravity üzerinde: Uzantılar (Extensions) → ··· → Install from VSIX
```

### Geliştirici Modunda Test Etme (F5)
```bash
git clone https://github.com/kullanici_adin/commity.git
cd commity
npm install
# Projeyi VS Code / Antigravity ile açın
# F5 tuşuna basın → Yeni test penceresi açılacaktır
```

## Gereksinimler

- VS Code `^1.85.0` veya Antigravity IDE
- Bir Git reposu (dosya değişiklikleri yapılmış veya görev listesi dosyası içeren)
- **Yapay zeka özellikleri için aşağıdakilerden biri:**
  - Antigravity IDE (Dahili yapay zeka sohbet paneli üzerinden)
  - GitHub Copilot Chat eklentisi
  - OpenRouter API anahtarı (veya uyumlu bir API endpoint)
  - OpenAI API Key (veya uyumlu bir API endpoint)
  - Ollama / LM Studio (Yerel modeller için, API anahtarı gerekmez)

## Ayarlar

| Ayar | Varsayılan | Açıklama |
|---|---|---|
| `commity.preferredProvider` | `"auto"` | `auto` / `chat` / `vscode-lm` / `openai` / `openrouter` / `mock` |
| `commity.openrouterApiKey` | `""` | OpenRouter API anahtarı |
| `commity.openrouterModel` | `"openrouter/auto"` | OpenRouter model ID'si |
| `commity.openaiApiKey` | `""` | OpenAI veya uyumlu API anahtarı |
| `commity.openaiBaseUrl` | `"https://api.openai.com/v1"` | API endpoint adresi (Ollama, LM Studio vb. destekler) |
| `commity.model` | `"gpt-4o"` | OpenAI sağlayıcısı için model adı |
| `commity.temperature` | `0.3` | Yaratıcılık oranı (0–2) |
| `commity.conventionalCommitStyle` | `true` | Kurallı commit formatını zorunlu kılar (`feat/fix/chore...`) |
| `commity.promptTemplate` | `""` | Özel prompt şablonu. `{tasks}` veya `{diff}` yer tutucusunu kullanın |
| `commity.preferredTasksFilename` | `""` | Otomatik dosya taramayı bypass edip sabit bir dosya seçer |
| `commity.autoCopy` | `false` | Üretilen komutları otomatik olarak panoya kopyalar |
| `commity.maxRetries` | `3` | AI geçersiz format ürettiğinde yapılacak maksimum deneme sayısı |

## TASKS.md Formatı

Eğer bir görev listesi dosyası kullanmayı tercih ederseniz, Commity standart görev listelerini okur:

```markdown
## Sprint 3

- [x] Fizik motorunu yaz            ← ✅ Algılanır (önceden seçilmemişti)
- [x] Çarpışma sistemini entegre et ← ✅ Algılanır
- [ ] Çoklu oyuncu desteği ekle     ← ⏭ Pas geçilir (tamamlanmamış)
- [x] Zaten önceden tamamlanmıştı   ← ⏭ Pas geçilir (HEAD commit'inde zaten [x] durumundaydı)
```

Sadece bu commit içerisinde `[ ]` durumundan `[x]` durumuna geçen satırlar dikkate alınır.

## Lisans

Bu proje MIT Lisansı ile lisanslanmıştır - detaylar için [LICENSE](./LICENSE) dosyasına göz atabilirsiniz.

MIT © 2026 Muhammed Egemen Geyik
