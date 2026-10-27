# فعال‌سازی ورود با حساب گوگل

کد ورود واقعی با Supabase Auth و جریان PKCE آماده است. در تنظیمات پیش‌فرض، ورود غیرفعال است و سایت بدون تماس با سرویس ورود در حالت مهمان کار می‌کند. فعال‌سازی به پروژه‌ای متعلق به صاحب سایت نیاز دارد.

## ۱. پروژهٔ Supabase

در https://supabase.com/dashboard یک پروژه بسازید. در تنظیمات API، Project URL و Publishable key عمومی را بردارید. این دو مقدار را در `auth-config.js` قرار دهید:

```js
window.CINEMA_AUTH_CONFIG = Object.freeze({
  supabaseUrl: 'https://PROJECT_REF.supabase.co',
  supabasePublishableKey: 'sb_publishable_...'
});
```

کلید service_role، کلید secret و Google Client Secret نباید وارد مخزن یا فایل‌های عمومی شوند.

در Authentication → URL Configuration این مقادیر را وارد کنید:

- Site URL: `https://riphatake16-debug.github.io/cinema500/`
- Redirect URLs: `https://riphatake16-debug.github.io/cinema500/`

## ۲. تنظیم گوگل

طبق راهنمای رسمی https://supabase.com/docs/guides/auth/social-sign-in/auth-google در Google Cloud / Google Auth Platform پروژه و OAuth client از نوع Web application بسازید. نام اپ را Cinema500 بگذارید. برای ورود فقط اطلاعات پایهٔ هویت و ایمیل کافی است؛ دسترسی Gmail یا خواندن نامه‌ها لازم نیست.

- Authorized JavaScript origin: `https://riphatake16-debug.github.io`
- Authorized redirect URI: آدرس callback که Supabase در بخش Google provider نمایش می‌دهد؛ معمولاً `https://PROJECT_REF.supabase.co/auth/v1/callback`

در Supabase → Authentication → Sign In / Providers → Google، سرویس را فعال کنید و Client ID و Client Secret گوگل را همان‌جا وارد کنید. Secret فقط در تنظیمات محافظت‌شدهٔ Supabase نگهداری می‌شود.

حالت Testing گوگل را با کاربر آزمایشی بررسی کنید. پیش از استفادهٔ عمومی، Audience / Publishing status را برای مخاطبان مدنظر تنظیم و الزامات نمایش‌داده‌شده در کنسول گوگل را تکمیل کنید.

## ۳. انتشار و بررسی نهایی

دو مقدار عمومی مرحلهٔ اول را در auth-config.js ثبت و روی main منتشر کنید. در «دفتر من» دکمهٔ «ادامه با گوگل» ظاهر می‌شود. ورود اول حساب می‌سازد؛ ورودهای بعدی همان هویت را برمی‌گردانند.

با دو حساب متفاوت و حالت مهمان بررسی کنید: خروج و ورود مجدد، لغو پنجرهٔ ورود، خطای شبکه، بازگشت از گوگل، و جدا بودن دفتر حساب‌ها. ورود واقعی پیش از تنظیم این پروژه و انجام این بررسی‌ها تأییدشده محسوب نمی‌شود.

## دامنهٔ قابلیت

Supabase هویت و نشست را تأیید می‌کند؛ ایمیلِ تایپ‌شده یا توکنِ صرفاً رمزگشایی‌شده به‌عنوان ورود پذیرفته نمی‌شود. دفتر هر حساب در همین مرورگر و جدا از مهمان و سایر حساب‌ها ذخیره می‌شود. افزودن دفتر مهمان به حساب با دکمهٔ صریح انجام می‌شود. اطلاعات مهمان پاک نمی‌شود. این نسخه همگام‌سازی میان دستگاه‌ها، دیتابیس نظرات یا چت ندارد؛ برای انتقال دفتر از پشتیبان استفاده کنید.

پاک‌کردن داده‌های مرورگر همچنان می‌تواند دفتر محلی را پاک کند. ورود با گوگل به‌تنهایی پشتیبان ابری نمی‌سازد. پلن‌ها و محدودیت‌های سرویس‌ها تابع شرایط خود آن‌هاست.
