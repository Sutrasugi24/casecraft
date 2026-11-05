# Casecraft Plugin SDK

Plugin SDK memungkinkan parser requirement, generator, validator, exporter, dan automation adapter ditambahkan tanpa mengubah generator inti. SDK berada di `dist/plugin-sdk.js`, tidak memiliki dependency runtime, dan tetap bekerja lokal.

## Model keamanan

- Plugin adalah kode JavaScript dengan hak akses proses yang menjalankannya. Hanya muat plugin yang ditinjau dan dipercaya.
- Browser Casecraft tidak mengeksekusi file `.js` yang diunggah pengguna. Plugin browser harus diimpor saat aplikasi dikemas atau dikembangkan.
- CLI hanya memuat plugin melalui opsi eksplisit `--plugin ./path/plugin.mjs`.
- SDK tidak memberi API jaringan. Namun plugin Node tetap dapat mengimpor modul Node; kebijakan CI harus mengaudit plugin sebelum digunakan.
- Requirement, fixture, dan workspace tidak pernah dikirim ke plugin yang tidak dipanggil secara eksplisit.

## Kontrak plugin

```js
import { createCasecraftPlugin } from "../../dist/plugin-sdk.js";

export default createCasecraftPlugin({
  id: "acme.qa",
  name: "ACME QA rules",
  sdkVersion: 1,
  setup(api) {
    api.registerValidator({
      id: "acme.qa.naming",
      label: "ACME naming policy",
      run(collection) {
        return { findings: [] };
      }
    });
  }
});
```

ID plugin dan capability wajib namespaced, misalnya `acme.qa` dan `acme.qa.naming`. Capability menyediakan `label` dan fungsi `run(input, context)`.

## Capability

| API | Input utama | Output yang diharapkan |
|---|---|---|
| `registerParser` | file atau teks spesifikasi | hasil parse dengan cases/warnings |
| `registerGenerator` | feature, requirement, coverage | `{ cases, generationReport }` atau `{ collection }` |
| `registerValidator` | collection | `{ findings }` |
| `registerExporter` | daftar test case | `{ content, extension, mime }` atau string |
| `registerAutomationAdapter` | laporan automation | daftar hasil yang memiliki Casecraft ID |

CLI mendukung generator melalui `--generator <capability-id>`, exporter melalui `--template <capability-id>`, dan menjalankan seluruh validator plugin pada `validate`.

## Contoh CLI

```bash
node ./bin/casecraft.mjs validate ./workspace.casecraft.json \
  --ci \
  --plugin ./examples/plugins/sample-validator.mjs
```

Plugin API menggunakan versi integer. Plugin dengan `sdkVersion` berbeda ditolak agar perubahan kontrak tidak gagal secara diam-diam.
