# موقع المقررات الجامعية

## محتويات المجلد
- `index.html` — صفحة الطالب
- `admin.html` — صفحة المدرس (تعمل على جهازك فقط، لا ترفعها إلى GitHub)
- `resources/` — ملفات الجلسات تُحفظ تلقائياً: `resources/CN1/session-1/...`
- `data.js` — يُنشأ ويُحدَّث تلقائياً من صفحة المدرس (يحمل بيانات الجلسات)
- `script.js`, `style.css` — المنطق والتنسيق

## الاستخدام على جهازك
1. افتح `admin.html` بمتصفح Chrome أو Edge وعيّن كلمة مرور.
2. اضغط «ربط المجلد» واختر هذا المجلد نفسه (مرة واحدة).
3. أضف جلسة وارفع ملفاتها، فتُحفظ في `resources/المقرر/session-رقم/` ويظهر المحتوى في `index.html`.

## النشر على GitHub (من الموقع بدون برامج)
1. أنشئ حساباً على github.com ثم New repository، اكتب اسماً (مثل `courses`)، اختر Public، ثم Create.
2. اضغط «uploading an existing file»، واسحب إليها: `index.html` و`script.js` و`style.css` و`data.js` ومجلد `resources` (لا تسحب `admin.html`).
3. اضغط Commit changes.
4. من Settings ← Pages: اختر Deploy from a branch ← Branch: main ← Folder: /(root) ← Save.
5. بعد دقيقة أو اثنتين يظهر رابط الموقع: `https://اسم-المستخدم.github.io/courses/`

## عند إضافة جلسة جديدة لاحقاً
1. أضفها من `admin.html` على جهازك كالعادة.
2. في مستودعك على GitHub: Add file ← Upload files، واسحب `data.js` ومجلد `resources` (أو الملفات الجديدة فقط) ← Commit changes.
3. انتظر دقيقة ثم حدّث صفحة الموقع بـ Ctrl+F5.
