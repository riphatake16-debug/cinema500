# سینما۵۰۰

سایت مستقل و ایستا با ۲۵۰ فیلم و ۲۵۰ سریال، خلاصه‌های فارسی، جست‌وجوی نام/رتبه/سال، تم شب و روز، منوهای شیشه‌ای و نمایش عمودی موبایل.

## حساب من در همین مرورگر

ثبت‌نام، ورود با گوگل و حساب ابری وجود ندارد. هر مرورگر یک دفتر محلی دارد: دیده‌ها، لیست تماشا، محبوب‌ها، نمره‌ها، یادداشت‌ها و تاریخ‌های تماشا در localStorage ذخیره می‌شوند. داده‌های قبلی و کلیدهای ذخیره‌سازی حفظ شده‌اند.

مرورگر یا دستگاه دیگر دفتر جداگانه دارد. پاک‌کردن داده‌های سایت، استفاده از حالت ناشناس یا پاک‌سازی فضای ذخیره‌سازی مرورگر می‌تواند اطلاعات را از بین ببرد. از «حساب من» پشتیبان JSON بگیرید و برای انتقال دفتر، همان فایل را در دستگاه جدید وارد کنید. ورود فایل‌های قدیمی پشتیبانی می‌شود و اطلاعات موجود در دفتر فعلی اولویت دارند.

## دفتر تماشا و پیشنهاد امشب

هر اثر یادداشت خصوصی و تاریخ تماشا دارد؛ مرور ماهانه با تقویم فارسی نمایش داده می‌شود. پیشنهاد امشب از ندیده‌ها و بر اساس حال‌وهوا، ژانر، زمان، امتیازها و محبوب‌ها انتخاب می‌کند و دلیل پیشنهاد را نشان می‌دهد. همهٔ این‌ها بدون API یا حساب خارجی کار می‌کنند.

## انتشار

GitHub Actions تصاویر محلی را از دو فایل artwork-1.zip و artwork-2.zip در _site باز می‌کند و سایت را روی GitHub Pages منتشر می‌کند. آزمایش‌های tests/static.test.mjs در همین مسیر اجرا می‌شوند. رتبه‌ها ثابت و متعلق به تاریخ درج‌شده در سایت‌اند. میزبانی تابع شرایط GitHub است.

هر ۵۰۰ اثر خلاصهٔ فارسی دارد. خلاصه‌های ۹۷ اثرِ تکمیل‌شده، همراه با منبع تطبیق هر عنوان، در content/summary-additions-fa.json ثبت شده‌اند. منابع مشخصات و تصاویر: IMDb، Cinemeta/Metahub، quantavil/imdb-dataset و alae-touba/imdb-rest-api. نام‌ها و تصاویر متعلق به صاحبان حقوق آن‌ها هستند و سایت وابستگی رسمی به IMDb ندارد.


## رتبه و آواتار

رتبه از تعداد آثار یکتای دیده‌شده در همین فهرست مشتق می‌شود؛ هر اثر ۱۰ XP دارد. سطح‌ها در ۰، ۵، ۱۵، ۳۵، ۷۵، ۱۵۰، ۳۰۰ و ۵۰۰ تماشا تغییر می‌کنند. برداشتن علامت تماشا امتیاز همان اثر را کم می‌کند؛ علامت‌زدن تکراری یا لیست تماشا امتیاز اضافه نمی‌دهد. رتبه پس از بازخوانی یا ورود پشتیبان از همان دفتر محلی محاسبه می‌شود و به ثبت‌نام نیاز ندارد. آواتارها SVG داخلی‌اند.

حرکت‌ها کوتاه و محدودند؛ کارت‌های خارج صفحه انیمیشن نمی‌گیرند و تنظیم کاهش حرکت دستگاه رعایت می‌شود. پس‌زمینهٔ قاب ویژه با دو لایه محو می‌شود؛ تعداد لایه‌ها ثابت است.


### Install on the home screen

The relative `manifest.webmanifest` keeps app identity, launch URL and scope within the GitHub Pages project. The custom vector mark is in `icons/cinema500.svg`, with 192px/512px PNG icons and a 180px Apple touch icon. The 512px mark stays within the maskable safe circle.

The requested display mode is `fullscreen`, with the browser's standard fallback to `standalone`. iOS home-screen launches use Apple metadata; OS status indicators depend on platform support. Open the HTTPS site and use the browser's **Install app / Add to Home screen** command, then launch its icon. The app still needs a network connection to load. Existing local journals and backup formats are unchanged.
