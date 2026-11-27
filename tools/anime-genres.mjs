export const GENRE_FA = {
  Action: 'اکشن',
  Adventure: 'ماجراجویی',
  Comedy: 'کمدی',
  Drama: 'درام',
  Ecchi: 'اچی',
  Fantasy: 'فانتزی',
  Horror: 'ترسناک',
  'Mahou Shoujo': 'دختر جادویی',
  Mecha: 'مکا',
  Music: 'موزیکال',
  Mystery: 'معمایی',
  Psychological: 'روان‌شناختی',
  Romance: 'عاشقانه',
  'Sci-Fi': 'علمی‌تخیلی',
  'Slice of Life': 'برشی از زندگی',
  Sports: 'ورزشی',
  Supernatural: 'فراطبیعی',
  Thriller: 'هیجان‌انگیز'
};

export const genreFa = (name, fallback = '') => GENRE_FA[name] || fallback || name;
