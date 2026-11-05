# Casecraft CLI

CLI Casecraft menjalankan generator, quality gate, exporter, dan perbandingan test run yang sama secara lokal. CLI tidak membuat Casecraft menjadi layanan dan tidak mengirim requirement, fixture, plugin, atau workspace ke jaringan.

## Perintah

```bash
node ./bin/casecraft.mjs generate \
  --feature "Checkout" \
  --requirement-file ./checkout.md \
  --output ./checkout.casecraft.json

node ./bin/casecraft.mjs validate ./checkout.casecraft.json --ci --json

node ./bin/casecraft.mjs export ./checkout.casecraft.json \
  --template markdown \
  --output ./checkout.md

node ./bin/casecraft.mjs compare ./checkout.casecraft.json \
  --baseline CYCLE-001 \
  --target CYCLE-002
```

`generate` juga menerima `--requirement "..."`, `--coverage happy,negative,edge,regression`, dan `--language id|en`. `export` menerima adapter bawaan atau capability exporter dari plugin yang dipercaya. `validate` menerima `--max-duplicate-ratio 0.1` dan `--fail-on-warnings`.

## Exit code

| Code | Arti |
|---:|---|
| `0` | Perintah berhasil; quality gate lulus. |
| `1` | File dapat dibaca, tetapi quality gate gagal. |
| `2` | Argumen, file, format proyek, plugin, atau adapter tidak valid. |

## Quality gate di CI

Script npm meneruskan path proyek setelah pemisah `--`:

```bash
npm run quality:ci -- ./artifacts/release.casecraft.json --json
```

Pipeline harus menyimpan `.casecraft.json` sebagai artifact lokal lebih dulu. Quality gate gagal ketika requirement atau acceptance criterion tidak memiliki test case yang terhubung, expected result kosong atau tidak terukur, rasio duplikasi melewati batas, atau regression case yang terdampak belum diperbarui. Warning dapat dijadikan blocking dengan `--fail-on-warnings`.

Contoh tahap CI generik:

```yaml
quality_gate:
  script:
    - npm ci
    - npm run quality:ci -- ./artifacts/release.casecraft.json --json
  artifacts:
    when: always
    paths:
      - artifacts/release.casecraft.json
```

## Plugin lokal

Gunakan `--plugin ./plugin.mjs` hanya untuk modul yang sudah ditinjau. Opsi dapat diulang. CLI tidak membuat sandbox JavaScript; plugin Node memiliki hak akses proses CI. Kontrak dan batas keamanannya dijelaskan di [`PLUGIN-SDK.md`](./PLUGIN-SDK.md).
