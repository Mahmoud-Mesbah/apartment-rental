# نظام حجز الشقق: نسخة React (Vite) + Google Apps Script + Google Sheets

الواجهة الخلفية (Code.gs + Google Sheets) هي نفسها كما في النسخة السابقة. الواجهة الأمامية صارت React 18 + Bootstrap 5 RTL، وتُبنى في **ملف HTML واحد** (`Index.html`) يعمل داخل Apps Script.

> الحالة: فُحص بناء الجملة لكل ملفات JSX/JS (23 ملفًا، بلا أخطاء) وتطابق الاستيرادات، لكن **لم يُشغَّل `npm run build` ولا النشر ولا الاختبار على جدول حقيقي** (لا يوجد وصول لـ npm registry في بيئة الكتابة). شغّل البناء على جهازك واتبع قائمة الاختبار في `SETUP_GUIDE.md` (من التسليم السابق).

## الهيكل
```
src/
  App.jsx               يختار الواجهة العامة أو لوحة المالك من ?page=admin
  api.js                call() = google.script.run مع withSuccessHandler/withFailureHandler + مهلة 60 ثانية
  mock.js               خادم وهمي للمعاينة المحلية فقط (npm run dev)
  utils.js              تنسيقات، رسالة واتساب، رابط wa.me
  public/               ListView, DetailView, BookingForm, SuccessView, Navbar, Footer ...
  admin/                AdminApp, BookingsPanel, ApartmentModal, ConfirmModal
  components/           SafeImg, StatusBadge, Toasts
apps-script/
  Code.gs               الواجهة الخلفية (doGet يخدم Index.html المبني)
  appsscript.json
  Index.html            ← يُنشأ بعد npm run package
```
React يعرض كل بيانات المستخدم كنصوص (بدون dangerouslySetInnerHTML)، فلا يوجد حقن HTML.

## البناء (على جهازك)
```
npm install
npm run dev        # معاينة محلية ببيانات وهمية (لا يتصل بـ Sheets)
npm run package    # يبني dist/index.html ثم ينسخه إلى apps-script/Index.html
```

## النشر في Apps Script
1. أنشئ Google Sheet ثم Extensions → Apps Script.
2. ملفات المشروع (3 فقط): `Code.gs` ← من `apps-script/Code.gs`، `appsscript.json` ← من `apps-script/appsscript.json` (فعّل إظهاره من Project Settings)، و HTML باسم `Index` ← الصق محتوى `apps-script/Index.html` كاملًا.
3. شغّل `setupProject` من المحرر ووافق على الصلاحيات (ينشئ الأوراق والإعدادات والـ Trigger). اختياريًا `addSampleData`.
4. في ورقة Settings اضبط `ownerWhatsApp` (أرقام دولية بدون +، مثل 201000000000) وباقي القيم.
5. انشر نشرين لنفس المشروع (Deploy → New deployment → Web app):
   - **الموقع العام:** Execute as: **Me**، Access: **Anyone**.
   - **لوحة المالك:** Execute as: **User accessing the web app**، Access: **Anyone with Google account**؛ افتح رابطها مضافًا إليه `?page=admin`.
6. بعد كل تعديل: ابنِ من جديد، الصق `Index.html` و`Code.gs`، وأنشئ **New version** لكل نشر.

سبب النشرين: `Session.getActiveUser().getEmail()` لا يعمل إلا عند التنفيذ كمستخدم زائر، فبه نعرف المالك. كل دوال `admin*` تتحقق من `OWNER_EMAIL` على الخادم، فإظهار واجهة الإدارة في المتصفح لا يمنح أي صلاحية.

## ملاحظات خاصة بـ React داخل Apps Script
- الصفحة تعمل داخل iframe؛ يُقرأ `?page=admin` عبر `google.script.url.getLocation` (مع مهلة 2 ثانية ثم الرجوع للصفحة العامة).
- Bootstrap CSS/JS والأيقونات تُضمَّن في الملف (الحجم عادة 1–2 ميجابايت). خط Cairo يُحمَّل من Google Fonts.
- حجم Index.html الكبير يعني تحميلًا أبطأ قليلًا عند أول زيارة (بدء بارد لـ Apps Script).
- باقي السلوك (منع الحجز المزدوج بـ LockService، منع تكرار الإرسال، الرجوع عن الكتابة الجزئية، الانتهاء الساعي، واتساب يدوي) كما شُرح في `SETUP_GUIDE.md`.
