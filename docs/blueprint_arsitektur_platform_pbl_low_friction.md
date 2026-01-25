# Blueprint Arsitektur Teknis – Platform PBL Low-Friction Berbasis Intuisi

Dokumen ini mengubah seluruh narasi desain kognitif menjadi **arsitektur sistem, alur interaksi, dan spesifikasi teknis** agar tim teknis (frontend, backend, AI, product) tidak salah menafsirkan intent.

---

## 1. Tujuan Sistem (Non-Negotiable)

### Objective Primer
Membangun platform PBL (Problem-Based Learning) yang:
- **Tidak terasa berpikir**, tapi
- **Membentuk intuisi kognitif lewat aksi berulang**
- **Inklusif**: Mendukung multi-bahasa (English & Indonesian) untuk jangkauan pengguna yang lebih luas.

### KPI Utama (bukan vanity)
- Time-to-first-action < **5 detik**
- 3 menit pertama **tanpa input teks**
- Rasio aksi : penjelasan ≥ **4 : 1**
- Error tidak menghentikan flow (no hard fail)

---

## 2. Model Mental Sistem (Core Paradigm)

### Paradigma Lama (HARUS DITINGGALKAN)
```
Pahami konteks → pikir → jawab → dinilai
```

### Paradigma Sistem Ini
```
Aksi refleks → feedback afektif → perubahan keadaan → (makna muncul belakangan)
```

> Catatan teknis: sistem **tidak menguji jawaban**, tapi **merekam pola keputusan**.

---

## 3. Unit Pembelajaran = Mikro-Keputusan

### Definisi Teknis
**Mikro-keputusan** = aksi ringan berdampak kecil tapi konsisten

Contoh bentuk:
- Tap
- Swipe
- Hold
- Pilih kecenderungan

Bukan:
- Menjawab soal
- Mengetik argumen
- Menyusun solusi lengkap

### Implikasi Arsitektur
- Setiap arena = **graph keputusan**, bukan list soal
- Node = keadaan
- Edge = aksi user

---

## 4. Arsitektur Sistem (High-Level)

```
[Client]
  └─ Interaction Engine
        └─ Action Event
              ├─ State Resolver
              ├─ Feedback Generator
              └─ Cognitive Trace Logger

[Backend]
  ├─ Arena Graph Engine
  ├─ User Cognitive State Model
  ├─ Error Propagation System
  └─ AI Response Orchestrator

[AI Layer]
  ├─ Pattern Interpreter
  ├─ Reflective Feedback Generator
  └─ Delayed Insight Engine
```

---

## 5. Frontend Architecture (Interaction-First)

### 5.1 Interaction Engine
Frontend **tidak menampilkan soal**, tapi:
- Situasi samar
- Aksi instingtif

#### Komponen
- `GestureInputLayer`
- `MicroActionHandler`
- `FlowStateManager`

> Keyboard **disabled by default** (feature flag).

---

### 5.2 Action Types (Canonical)

```ts
Action = {
  type: 'tap' | 'swipe' | 'hold' | 'bias-select'
  intensity?: number // untuk spektrum
}
```

Tidak ada `text-input` di fase awal arena.

---

## 6. Backend – Arena Graph Engine

### 6.1 Arena = Directed State Graph

```ts
StateNode {
  id
  situation_payload
  allowed_actions[]
  hidden_weights
}
```

```ts
Edge {
  action_type
  state_transition
  latent_effects
}
```

> User tidak “salah” — hanya berpindah state berbeda.

---

### 6.2 Error Propagation System
Kesalahan:
- Tidak menghentikan flow
- Tidak diberi label
- Mempengaruhi kondisi selanjutnya

Implementasi:
- Flag `latent_mistake`
- Digunakan kembali 2–3 state kemudian

---

## 7. AI Layer – Peran yang Tepat

### 7.1 AI Tidak Bertanya
AI **tidak pernah**:
- "Mengapa kamu memilih ini?"
- "Jelaskan jawabanmu"

AI hanya:
- Menanggapi aksi
- Mengubah situasi
- Memberi feedback singkat

---

### 7.2 Feedback Generator

Tahap awal:
- Afektif (emosi ringan)
- Non-eksplanatif

Contoh output:
- "hmm… hampir"
- "ini beda"

Penjelasan logis:
- Tertunda
- Opsional

---

## 8. Delayed Insight Engine

### Mekanisme
- Insight muncul setelah **2–3 siklus aksi**
- Satu kalimat
- Menghubungkan pola, bukan aturan

Contoh:
> "Pilihanmu barusan mirip dengan yang tadi — bedanya efeknya terasa sekarang."

---

## 9. Mengetik: Status & Kontrol

### Aturan Besi
- Mengetik = **endgame mechanic**
- Tidak memblok progres

### Tahapan
1. Early arena: no typing
2. Mid arena: 1–3 kata (chip-based)
3. Late arena: bebas, opsional

Keyboard:
- Disembunyikan
- Autocomplete agresif

---

## 10. Cognitive Trace Logging (Paling Penting)

Yang dicatat:
- Urutan aksi
- Reaksi terhadap feedback
- Perubahan kecenderungan

Bukan:
- Benar/salah
- Skor

Ini dipakai untuk:
- Adaptasi arena
- Personalisasi kesulitan

---

## 11. Anti-Dopamine Trap Safeguards

### Risiko
- Streak chasing
- Progress addiction

### Countermeasures
- Pattern break problem
- Reward ditunda
- Kadang "cukup masuk akal"

---

## 12. Tes Brutal (Acceptance Test)

Platform **lulus** hanya jika:
- User bisa 3 menit pertama tanpa sadar belajar
- Tidak ada layar kosong menunggu input
- Salah terasa ringan

Kalau gagal → **ubah urutan kognitif, bukan fitur**.

---

## 13. Prinsip Penutup (Untuk Tim Teknis)

> Kita tidak membangun sistem evaluasi.
> Kita membangun mesin pembentuk refleks berpikir.

Kalau satu komponen membuat user berhenti dan berpikir sadar terlalu cepat — itu bug arsitektural, bukan UX detail.

