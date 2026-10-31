# ورود رایگان به سینما ۵۰۰ (Firebase Spark) — راه‌اندازی

**وضعیت فعلی:** کد سایت و رابط ثبت‌نام آماده شده، اما **تا وقتی پروژه Firebase ساخته و مشخصات اتصال وارد نشده‌اند، ورود آنلاین فعال نیست.** تغییرات در شاخه جدا نگه داشته شده‌اند تا سایت اصلی خراب نشود. هیچ راهی برای ساخت پروژه Firebase به نام صاحب حساب بدون اقدام/اتصال خود او وجود ندارد.

## شرط صفر هزینه — بسیار مهم

- در Firebase Console فقط طرح **Spark (No cost)** را انتخاب کنید؛ به Blaze ارتقا ندهید.
- کارت بانکی، Cloud Billing account یا Billing linkage اضافه نکنید؛ اتصال Billing می‌تواند پروژه را به Blaze تبدیل کند.
- از امکانات نیازمند طرح Blaze استفاده نکنید (برای این قابلیت فعلاً فقط Firebase Authentication لازم است).
- سهمیه‌ها و سیاست‌ها ممکن است در طول زمان تغییر کنند؛ تجاوز از سهمیه Spark باعث محدودشدن سرویس می‌شود و **بدون ارتقا به Blaze قبضی ایجاد نمی‌کند**.
- تأییدکننده رسمی این بخش: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## یک‌بار راه‌اندازی توسط صاحب حساب

1. وارد https://console.firebase.google.com/ شوید، **Create a project** را بزنید و یک پروژه برای Cinema500 بسازید، با طرح Spark. Google Analytics اختیاری است؛ برای کمینه‌کردن داده شخصی، غیرفعال بگذارید.
2. در Project Overview گزینه **Add app → Web** را انتخاب کنید. نامی مثل Cinema500 Web بدهید. لازم نیست Firebase Hosting را فعال کنید چون سایت روی GitHub Pages است.
3. در **Build → Authentication → Get started → Sign-in method** روش‌های **Email/Password** و **Google** را فعال کنید. ورود تلفنی/شماره تماس را فعال نکنید.
4. در Authentication → Settings → Authorized domains دامنه \`riphatake16-debug.github.io\` را اضافه کنید، اگر از پیش مجاز نیست. **خود مسیر \`/cinema500/\` را اینجا وارد نکنید.** برای ورود گوگل در صورت درخواست، ایمیل پشتیبانی پروژه را انتخاب کنید و تنظیمات OAuth مربوط به پروژه را تکمیل کنید.
5. در **Project settings → Your apps → Web app → SDK setup/config** مقدار عمومی Web app config را کپی کنید. تنها فیلدهای \`apiKey\`، \`authDomain\`، \`projectId\` و \`appId\` (و سایر مقادیر عمومی مجاز مانند \`messagingSenderId\`) لازم‌اند. این‌ها **کلید ادمین نیستند**.
6. در فایل \`firebase-config.js\`، مقدار \`null\` را با آبجکت عمومی پروژه عوض کنید. مثال:
   \`\`\`js
   window.CINEMA500_FIREBASE_CONFIG = {
     apiKey: "PUBLIC_WEB_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxx"
   };
   \`\`\`
7. پس از فعال‌شدن صفحه اصلی، در مرورگر واقعی گوشی/رایانه تست کنید: ثبت‌نام ایمیل → ایمیل تأیید → ورود → بازیابی رمز → خروج → ورود گوگل.
8. ورود گوگل از **WebView در APK فعلی پشتیبانی نمی‌شود**؛ گوگل OAuth در embedded webview را مسدود می‌کند. برای APK، روش بومی Android Credential Manager به همراه نسخه APK امضاشده جدید لازم خواهد بود. تا آن موقع **ورود با ایمیل** در WebView قابل آزمون است، اما قبل از انتشار عمومی حتماً تست دستگاه انجام شود.

## ویژگی‌های امنیت و حریم خصوصی

- SDK مرورگر Firebase Auth نسخه **13.1.0** بارگذاری می‌شود و فقط اگر config واقعی داشته باشیم.
- فقط config **عمومی** Web app در مخزن منتشر شود. **هرگز** Service Account JSON، private key، Google Client Secret، API secret یا گذرواژه را در GitHub قرار ندهید.
- ثبت‌نام و ورود با Firebase Auth انجام می‌شود. ایمیل تأیید و بازیابی رمز ارائه می‌شود. لینک حذف حساب آنلاین نیز وجود دارد.
- «حساب من» قبلی و بکاپ JSON بدون تغییر باقی می‌مانند؛ **هیچ یادداشت یا فهرست تماشا به Firebase منتقل نمی‌شود**.
- برای نظرات عمومی، در مرحله بعدی باید Firestore Rules محکم، گزارش تخلف، حذف نظر، جلوگیری از اسپم و سیاست محتوای کاربر طراحی شود. **فعلاً نظرات عمومی فعال نشده‌اند.**
- اگر پس از ساخت اکانت، کاربر آن را حذف کند، داده‌های دفتر محلی و فایل‌های بکاپ جدا هستند و به انتخاب خود کاربر مدیریت می‌شوند.

## بررسی نهایی قبل از ادغام با شاخه اصلی

- [ ] Firebase Spark بدون Billing ساخته شده.
- [ ] config عمومی ثبت و بررسی شده؛ هیچ secret اضافه نشده.
- [ ] Authorized domains و Google provider راه افتاده.
- [ ] تست واقعی ایمیل و Google در مرورگر سایت موفق.
- [ ] تست ورود ایمیل در APK و عدم هدایت Google OAuth به WebView انجام شده.
- [ ] متن سیاست حریم خصوصی برای نام/ایمیل تماس ناشر نهایی شده.
- [ ] برای ورود گوگل بومی در APK برنامه انتشار نسخه جدید طراحی شده.

**مستندات:** https://firebase.google.com/docs/auth/web/start · https://firebase.google.com/docs/auth/web/google-signin · https://developers.google.com/identity/siwg/supported-browsers · https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
