// ============================================================
//  TIL ALMASHTIRISH (i18n) — 3 til
// ------------------------------------------------------------
//  'uz' — O'zbek (lotin, asl manba)
//  'kr' — O'zbek (kiril) — lotin→kiril AVTOMATIK transliteratsiya
//  'ru' — Rus — eng ko'p ko'rinadigan iboralar lug'ati (qolgani uz)
//
//  Yondashuv: butun ilovadagi matnlarni qo'lda o'rab chiqmasdan,
//  global DOM matn qatlami orqali o'giriladi. Faqat MATN tugunlari
//  va placeholder o'zgaradi — input qiymati / ma'lumotlar TEGILMAYDI.
//  React matnni o'zgartirsa — MutationObserver qayta o'giradi.
// ============================================================

export const TILLAR = [
  { id: 'uz', nom: "O'zbek" },
  { id: 'kr', nom: 'Ўзбекча' },
  { id: 'ru', nom: 'Русский' },
];

// Apostrof variantlarini bittaga keltirish
function normApos(s) { return s.replace(/[’ʻʼ‘`]/g, "'"); }

// ----- Lotin → Kiril (tartib muhim: ko'p harfli birikmalar avval) -----
const KR_PAIRS = [
  ["o'", 'ў'], ["O'", 'Ў'],
  ["g'", 'ғ'], ["G'", 'Ғ'],
  ['yo', 'ё'], ['Yo', 'Ё'],
  ['yu', 'ю'], ['Yu', 'Ю'],
  ['ya', 'я'], ['Ya', 'Я'],
  ['ye', 'е'], ['Ye', 'Е'],
  ['sh', 'ш'], ['Sh', 'Ш'],
  ['ch', 'ч'], ['Ch', 'Ч'],
  ['ts', 'ц'], ['Ts', 'Ц'],
  ['zh', 'ж'], ['Zh', 'Ж'],
  ['a', 'а'], ['b', 'б'], ['c', 'с'], ['d', 'д'], ['e', 'е'], ['f', 'ф'], ['g', 'г'],
  ['h', 'ҳ'], ['i', 'и'], ['j', 'ж'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'],
  ['o', 'о'], ['p', 'п'], ['q', 'қ'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['v', 'в'], ['x', 'х'], ['y', 'й'], ['z', 'з'],
  ['A', 'А'], ['B', 'Б'], ['C', 'С'], ['D', 'Д'], ['E', 'Е'], ['F', 'Ф'], ['G', 'Г'],
  ['H', 'Ҳ'], ['I', 'И'], ['J', 'Ж'], ['K', 'К'], ['L', 'Л'], ['M', 'М'], ['N', 'Н'],
  ['O', 'О'], ['P', 'П'], ['Q', 'Қ'], ['R', 'Р'], ['S', 'С'], ['T', 'Т'], ['U', 'У'],
  ['V', 'В'], ['X', 'Х'], ['Y', 'Й'], ['Z', 'З'],
  ["'", 'ъ'],
];

export function lotinToKrill(s) {
  if (!s) return s;
  let t = normApos(s);
  for (const [a, b] of KR_PAIRS) t = t.split(a).join(b);
  return t;
}

// ----- Rus lug'ati (uz lotin → rus) — eng ko'p ko'rinadigan iboralar -----
const RU = {
  // Navigatsiya
  'Savdo': 'Продажа', 'Zakaslar': 'Заказы', 'Mijoz / Usta': 'Клиент / Мастер',
  "Yo'qlama / Avans": 'Посещаемость / Аванс', 'Hisobot': 'Отчёт', 'Ishchilar': 'Работники',
  'Narxlar': 'Цены', 'Jurnal': 'Журнал', 'Sozlamalar': 'Настройки',
  'Savdo boshqaruv bazasi': 'База управления продажами',
  // Tugmalar
  'Saqlash': 'Сохранить', 'Saqlandi': 'Сохранено', 'Saqlanmoqda...': 'Сохранение...',
  'Bekor': 'Отмена', "Qo'shish": 'Добавить', "O'chirish": 'Удалить', 'Tahrirlash': 'Редактировать',
  'Nusxalash': 'Копировать', 'Yopish': 'Закрыть', 'Chiqish': 'Выход', 'Ha': 'Да',
  "Ha, o'chirish": 'Да, удалить', 'Tasdiqlash': 'Подтверждение', 'Tozalash': 'Очистить',
  "O'rnatish": 'Установить', 'Ilovani o\'rnatish': 'Установить приложение',
  'Qabul qilish': 'Принять', 'Chek chiqarish': 'Печать чека', 'Chek': 'Чек', 'Chop etish': 'Печать',
  "To'lov qo'shish": 'Добавить оплату', "Zakasni saqlash": 'Сохранить заказ',
  'Internetdan joriy kursni olish': 'Получить курс из интернета',
  // Savdo / hisob
  'Mijoz': 'Клиент', 'Usta': 'Мастер', 'Tovarlar': 'Товары', "Tovar qo'shish": 'Добавить товар',
  'Tovar qo\'shilmagan': 'Товар не добавлен', "Hisob-kitob va To'lov": 'Расчёт и оплата',
  'Dastafka': 'Доставка', 'Kazirok (material + 25%)': 'Резка (материал + 25%)', 'Kazirok': 'Резка',
  'Hisob-kitob': 'Расчёт', 'Umumiy summa': 'Общая сумма', 'Kiritilgan jami to\'lov': 'Внесённая оплата',
  'Qoldiq qarz summasi': 'Остаток долга', 'Izoh': 'Примечание', 'Razmeri': 'Размер',
  "O'lchov": 'Размер', 'Narx': 'Цена', 'Narxi': 'Цена', 'Rang': 'Цвет', 'Nomi': 'Название',
  'Nom': 'Имя', 'Jami': 'Итого', 'Sana': 'Дата', 'Soni': 'Кол-во', 'Uzunlik (m)': 'Длина (м)',
  'List / Material': 'Лист / Материал', 'Narx turi': 'Тип цены', 'Chakana': 'Розница', 'Optom': 'Опт',
  "Variant (bo'lish)": 'Вариант', 'Stanok turi': 'Тип станка', 'Teskari quloq': 'Обратное ухо',
  // Zakaslar / holat
  'Filtr': 'Фильтр', 'Hammasi': 'Все', 'Hisoblashdi': 'Расчёт', 'Jarayonda': 'В процессе',
  'Tayyor': 'Готово', 'Yopilgan': 'Закрыто', 'Faqat qarzdor': 'Только должники',
  'Tushum': 'Доход', 'Qarz': 'Долг', "To'langan": 'Оплачено', 'Qisman': 'Частично',
  'Tayyor bo\'ldi': 'Готово', 'Chiqib ketti': 'Отгружено', 'Jarayonga': 'В процесс',
  'Qayta ochish': 'Открыть заново', "To'lovlar tarixi:": 'История оплат:',
  'Zakaslar topilmadi': 'Заказы не найдены',
  // Mijozlar / ishchilar
  'Mijozlar': 'Клиенты', 'Ustalar': 'Мастера', 'Yangi mijoz': 'Новый клиент',
  'Yangi usta': 'Новый мастер', 'Yangi ishchi': 'Новый работник', 'Manzil': 'Адрес',
  "Orientir (mo'ljal)": 'Ориентир', 'Telefon raqamlari': 'Телефоны', 'Ism familiya *': 'Имя фамилия *',
  'Ism familiya': 'Имя фамилия', "Oylik ish haqi (so'm)": 'Зарплата (сум)', 'Lavozim(lar)': 'Должность',
  'Qobiliyatlari': 'Навыки', 'Kamchiliklari': 'Недостатки', "Ko'tarish": 'Повысить', 'Tushirish': 'Понизить',
  // Yo'qlama
  'Belgilash': 'Отметка', 'Kalendar': 'Календарь', 'Avans': 'Аванс', 'Keldi': 'Пришёл',
  'Yarim': 'Половина', 'Kelmadi': 'Не пришёл', 'Yarim kun': 'Полдня',
  'Davomat kalendari': 'Календарь посещаемости', 'Oyni tanlang': 'Выберите месяц',
  'Sanani tanlang': 'Выберите дату', 'Hammasi keldi': 'Все пришли', 'Ishlangan': 'Отработано',
  'Hozirgi haqqi': 'Текущая зарплата',
  // Narxlar
  'Listlar narxlari': 'Цены листов', 'Metrli': 'Метражные', 'Aksessuarlar': 'Аксессуары',
  'Listlar': 'Листы', "Yangi list qo'shish": 'Добавить лист', "Yangi tovar qo'shish": 'Добавить товар',
  "Yangi aksessuar qo'shish": 'Добавить аксессуар', 'Optom narx': 'Опт. цена', 'Chakana narx': 'Розн. цена',
  'Qalinlik (mm)': 'Толщина (мм)',
  // Ishchilar boshqaruvi
  'Lavozimlar': 'Должности', 'Qobiliyatlar': 'Навыки', 'Kamchiliklar': 'Недостатки', 'Daraja': 'Уровень',
  // Hisobot
  'Umumiy aylanma': 'Общий оборот', 'Holat bo\'yicha': 'По статусу', "O'rtacha vaqt": 'Среднее время',
  "To'lov bo'yicha": 'По оплате', 'Qarzdor': 'Должник', 'Qisman to\'langan': 'Частично оплачено',
  // Sozlamalar
  'Asosiy Sozlamalar': 'Основные настройки', "Do'kon nomi": 'Название магазина',
  "Do'kon telefoni (chekda chiqadi)": 'Телефон магазина (на чеке)', 'Dollar kursi (1 USD)': 'Курс доллара (1 USD)',
  'Olish': 'Покупка', 'Sotish': 'Продажа', 'Avtomatik': 'Автоматически', 'Ranglar': 'Цвета',
  'Mavzu': 'Тема', 'Til': 'Язык', "Yozuv o'lchami (shrift)": 'Размер шрифта', 'Kichik': 'Маленький',
  'Oddiy': 'Обычный', 'Katta': 'Большой', 'Juda katta': 'Очень большой',
  'Zaxira (Backup)': 'Резервная копия', 'Zaxira yuklab olish': 'Скачать резервную копию',
  'Fayldan yuklash': 'Загрузить из файла', 'Foydalanuvchilar': 'Пользователи',
  'Foydalanuvchi qo\'shish': 'Добавить пользователя', 'Login': 'Логин', 'Parol': 'Пароль', 'Rol': 'Роль',
  'Administrator': 'Администратор', 'Ishchi': 'Работник', 'Asoschi': 'Основатель',
  // Jurnal
  'Amallar jurnali': 'Журнал действий', 'Hamma foydalanuvchi': 'Все пользователи',
  'Amallar topilmadi': 'Действия не найдены', 'Tizimga kirdi': 'Вошёл в систему',
  'Tizimdan chiqdi': 'Вышел из системы', 'Zakas yaratdi': 'Создал заказ', "Zakasni o'chirdi": 'Удалил заказ',
  "To'lov qo'shdi": 'Добавил оплату', "Holatni o'zgartirdi": 'Изменил статус',
  // Umumiy
  'Yuklanmoqda...': 'Загрузка...', "Qidirish...": 'Поиск...', "so'm": 'сум',

  // ===== Kengaytirilgan: toast / xabarlar =====
  'Mijozni tanlang': 'Выберите клиента', "Kamida 1 ta tovar qo'shing": 'Добавьте хотя бы 1 товар',
  'Uzunlik yoki sonini kiriting': 'Введите длину или количество', 'Nom kiriting': 'Введите название',
  'Ism kiriting': 'Введите имя', 'Summani kiriting': 'Введите сумму',
  'Login va parol kiriting': 'Введите логин и пароль', 'Bunday login bor': 'Такой логин уже есть',
  "Foydalanuvchi qo'shildi": 'Пользователь добавлен', "O'chirildi": 'Удалено', "Qo'shildi": 'Добавлено',
  "Rang qo'shildi": 'Цвет добавлен', 'Rang nomini kiriting': 'Введите название цвета',
  'Bu rang allaqachon bor': 'Этот цвет уже есть', 'Nusxalandi': 'Скопировано',
  'Kurs saqlandi': 'Курс сохранён', "Zakas o'chirildi": 'Заказ удалён',
  "To'lov qabul qilindi": 'Оплата принята', "To'lov summasini kiriting": 'Введите сумму оплаты',
  "Zakas tayyor bo'ldi": 'Заказ готов', "Ishchi qo'shildi": 'Работник добавлен',
  "Ishchi o'chirildi": 'Работник удалён', "Usta qo'shildi": 'Мастер добавлен',
  "Mijoz qo'shildi": 'Клиент добавлен', "Aksessuar qo'shildi": 'Аксессуар добавлен',
  "List qo'shildi": 'Лист добавлен', "Lavozim qo'shildi": 'Должность добавлена',
  "Qobiliyat qo'shildi": 'Навык добавлен', "Kamchilik qo'shildi": 'Недостаток добавлен',
  'Bunday lavozim bor': 'Такая должность уже есть', 'Saqlashda xatolik': 'Ошибка сохранения',
  'Kursni olishda xatolik — internetni tekshiring': 'Ошибка получения курса — проверьте интернет',

  // ===== Placeholderlar / bo'sh holatlar =====
  'Mijoz qidirish...': 'Поиск клиента...', 'Usta qidirish...': 'Поиск мастера...',
  'Ishchi qidirish...': 'Поиск работника...', 'Mijoz, manzil, usta yoki raqam...': 'Клиент, адрес, мастер или номер...',
  'Foydalanuvchi, amal yoki tafsilot...': 'Пользователь, действие или детали...',
  "Zakas uchun qo'shimcha eslatma...": 'Доп. примечание к заказу...', "+ Raqam qo'shish": '+ Добавить номер',
  'Telefon kiritilmagan': 'Телефон не указан', "Mijoz tanlang yoki yangisini qo'shing": 'Выберите клиента или добавьте нового',
  "Hozircha bo'sh": 'Пока пусто', 'Mijozlar mavjud emas': 'Клиентов нет', 'Ustalar topilmadi': 'Мастера не найдены',
  'Ishchilar mavjud emas': 'Работников нет', 'Listlar mavjud emas': 'Листов нет',
  'Aksessuarlar mavjud emas': 'Аксессуаров нет', 'Lavozimlar mavjud emas': 'Должностей нет',
  'Kamchiliklar mavjud emas': 'Недостатков нет', 'Qobiliyatlar mavjud emas': 'Навыков нет',
  'Tovar nomi': 'Название товара', 'Aksessuar nomi': 'Название аксессуара', 'Usta ismi': 'Имя мастера',
  'Tovar qidirish (list, metrli, aksessuar...)': 'Поиск товара (лист, метраж, аксессуар...)',
  "masalan: katta do'kon yonida": 'напр.: рядом с большим магазином', 'masalan: xrom': 'напр.: хром',
  "masalan: Ko'k SMZ": 'напр.: Синий SMZ', 'Summa': 'Сумма', "To'lov izohi...": 'Примечание к оплате...',
  'Aksessuar': 'Аксессуар', 'Birlik': 'Единица', 'dona': 'шт', 'kg': 'кг',

  // ===== To'lov bo'limi =====
  "To'lovlar": 'Оплаты', "To'lov turi": 'Тип оплаты', "So'mda": 'В сумах', 'Dollorda': 'В долларах',
  'Clickda': 'Click', 'Kartada': 'Картой', 'Perechisleniyada': 'Перечислением',
  'Kurs:': 'Курс:', "So'mdagi qiymati:": 'Значение в сумах:',

  // ===== Pickerlar (modal sarlavhalari) =====
  'Mijoz tanlash': 'Выбор клиента', 'Ustani tanlang': 'Выберите мастера',
  'Guruhni tanlang': 'Выберите группу', 'Qidiruv natijasi': 'Результат поиска',

  // ===== Chek (kvitansiya) =====
  'Xaridingiz uchun rahmat!': 'Спасибо за покупку!', "To'landi": 'Оплачено', 'Qoldiq qarz': 'Остаток долга',
  "To'lovlar:": 'Оплаты:', "To'liq to'langan": 'Полностью оплачено', "To'lanmagan": 'Не оплачено',

  // ===== Hisobot / zakas kartasi =====
  'Orqaga': 'Назад', "Zakaslar yo'q": 'Заказов нет', "O'rtacha tayyorlanish": 'Среднее изготовление',
  "O'rtacha chiqib ketish": 'Средняя отгрузка', "Qabuldan chiqishgacha (o'rtacha)": 'От приёма до отгрузки (в среднем)',
  'Hisob (xom)': 'Расчёт (черновик)', "Noma'lum": 'Неизвестно', 'Usta:': 'Мастер:', 'Manzil:': 'Адрес:', 'Qarz:': 'Долг:',

  // ===== Boshqa yorliqlar =====
  "Variantlar (bo'lak soni + razmer)": 'Варианты (кол-во частей + размер)', "Metri uchun narx (so'm)": 'Цена за метр (сум)',
  "Avans qo'shish": 'Добавить аванс', "Oylik o'zgarishlar tarixi:": 'История изменений зарплаты:',
  'Hisob': 'Расчёт', 'Saralash': 'Сортировка', 'Qiymat': 'Значение',

  // ===== 3-partiya: butun ilova bo'ylab qolgan matnlar =====
  // App / umumiy
  'Random': 'Случайно', 'Doimiy': 'Постоянно', 'Ulanmoqda...': 'Подключение...',
  "Qarz to'lash": 'Погашение долга', 'Saqlandi!': 'Сохранено!',
  'Nusxa olish uchun saqlangan zakas topilmadi': 'Нет сохранённого заказа для копирования',
  "Bu zakas tovarlarini nusxalab bo'lmadi (katalogda topilmadi)": 'Не удалось скопировать товары заказа (нет в каталоге)',
  'Zakas qayta ochildi (jarayonda)': 'Заказ открыт заново (в процессе)',
  'Zakas yopildi (chiqib ketdi)': 'Заказ закрыт (отгружен)', "Holat o'zgartirildi": 'Статус изменён',
  'Butun amallar jurnali tozalansinmi?': 'Очистить весь журнал действий?',
  'Yopilgan (chiqib ketdi)': 'Закрыто (отгружено)', 'Telefon': 'Телефон', 'Holat': 'Статус', 'Orientir': 'Ориентир',
  // Login
  "Login yoki parol noto'g'ri.": 'Неверный логин или пароль.',
  'Kirish uchun login va parolni kiriting': 'Введите логин и пароль для входа', 'Kirish': 'Вход',
  'Profil': 'Профиль', "Telefon/kompyuterga ilova qilib qo'ying": 'Установите как приложение на телефон/компьютер',
  // YangiZakaz
  '0 dan katta son kiriting': 'Введите число больше 0', "Hali tovar qo'shilmagan": 'Товары ещё не добавлены',
  "Birinchi tovarni qo'shing": 'Добавьте первый товар', 'Oxirgi zakasdan nusxa': 'Копия последнего заказа',
  "Tovar qo'shilgach, hisob-kitob va to'lov shu yerda chiqadi.": 'После добавления товара расчёт и оплата появятся здесь.',
  "Jami (so'm)": 'Итого (сум)', '— tanlang —': '— выберите —', 'Narxi:': 'Цена:',
  'Tovarni takrorlash': 'Повторить товар', "Tovarni o'chirish": 'Удалить товар',
  'Tovarni yopish': 'Свернуть товар', 'Tovarni ochish': 'Развернуть товар', "Ha, o'chir": 'Да, удалить',
  // Zakaslar
  'Qarz qoldiq': 'Остаток долга', 'Izoh:': 'Примечание:', 'Chiqib ketdi': 'Отгружено',
  "tayyor bo'lgach": 'после готовности',
  // Chek
  'Zakas · Chek': 'Заказ · Чек', 'Mijoz:': 'Клиент:', 'Umumiy:': 'Итого:', "To'landi:": 'Оплачено:',
  'Qoldiq qarz:': 'Остаток долга:', 'Tel:': 'Тел:', 'Telegram orqali yuborish': 'Отправить через Telegram',
  'Chop etish yoki PDF saqlash': 'Печать или сохранить PDF', 'Chop / PDF': 'Печать / PDF',
  // Pickers
  'Profnastil': 'Профнастил', 'Guruhlar': 'Группы', "Bu guruhda tovar yo'q": 'В этой группе нет товаров',
  'Saqlash va tanlash': 'Сохранить и выбрать', '+ Yangi mijoz ochish': '+ Создать нового клиента',
  'Boshqa usta': 'Другой мастер', 'Boshqa': 'Другой', 'dollar': 'доллар',
  // Sozlamalar — xabar/labellar
  'Olinmoqda…': 'Получение…', "Shrift o'lchami o'zgardi": 'Размер шрифта изменён',
  'Zaxira yuklab olindi': 'Резервная копия скачана', 'Xatolik': 'Ошибка',
  'Listlardan (avtomatik)': 'Из листов (автоматически)', "Listlar yo'q": 'Нет листов',
  "Qo'shimcha ranglar": 'Дополнительные цвета', "Qo'shimcha rang yo'q": 'Нет доп. цветов',
  "Diqqat! Mavjud barcha ma'lumot fayldagi bilan almashtiriladi. Davom etilsinmi?": 'Внимание! Все данные будут заменены данными из файла. Продолжить?',
  "Xatolik: fayl noto'g'ri": 'Ошибка: неверный файл', ' — siz': ' — вы',
  'Butun ilovadagi yozuvlarni kattaroq yoki kichikroq qiling. Tanlov shu qurilmada saqlanadi.': 'Увеличьте или уменьшите текст во всём приложении. Выбор сохраняется на этом устройстве.',
  'Til': 'Язык',
  // Theme nomlari (o'zbekcha so'zlar)
  "Yorug'": 'Светлый', "Qorong'i": 'Тёмный', "Tungi ko'k": 'Ночной синий', "O'rmon": 'Лес',
  'Siyohrang': 'Чернильный', 'Qahva': 'Кофе', 'Dengiz': 'Море', 'Oltin': 'Золото', 'Vulqon': 'Вулкан',
  'Galaktika': 'Галактика', 'Atirgul': 'Роза', 'Ametist': 'Аметист', 'Shafaq': 'Закат', 'Marjon': 'Коралл',
  'Qirmizi': 'Багровый', 'Qora-oq': 'Чёрно-белый', 'Zumrad': 'Изумруд', 'Yoqut': 'Рубин', 'Safir': 'Сапфир',
  'Nefrit': 'Нефрит', 'Bronza': 'Бронза', "Po'lat": 'Сталь', 'Arktika': 'Арктика', 'Tropik': 'Тропики',
  'Sahro': 'Пустыня', 'Vino': 'Вино', 'Kobalt': 'Кобальт', 'Fuksiya': 'Фуксия', 'Limon': 'Лимон',
  'Turkuaz': 'Бирюза', "Bo'ron": 'Шторм', 'Qaroqchi': 'Пират', 'Sehrgar': 'Маг', 'Kometa': 'Комета',
  'Obsidiyan': 'Обсидиан', 'Kungaboqar': 'Подсолнух', 'Yalpiz': 'Мята', 'Qon': 'Кровь', 'Muz': 'Лёд',
  'Asal': 'Мёд', 'Orkide': 'Орхидея', 'Jinsi': 'Джинс', 'Karamel': 'Карамель', "Ko'pik": 'Пена',
  'Kuz': 'Осень', 'Bahor': 'Весна', 'Mokko': 'Мокко', 'Tumanlik': 'Туманность', 'Zaharli': 'Ядовитый',
  'Shohona': 'Королевский', 'Shaftoli': 'Персик', 'Laguna': 'Лагуна', 'Lavanda': 'Лаванда', 'Mandarin': 'Мандарин',
  'Moh': 'Мох', 'Rezavor': 'Ягода', 'Shifer': 'Сланец', 'Malina': 'Малина', 'Zaytun': 'Олива', 'Dolchin': 'Корица',
  'Azur': 'Лазурь', 'Uzum': 'Виноград', 'Pista': 'Фисташка', 'Gilos': 'Вишня', 'Pushti': 'Розовый',
  "Ko'mir": 'Уголь', 'Yulduz': 'Звезда', 'Mango': 'Манго', 'Lilas': 'Сирень', 'Uglerod': 'Углерод', 'Muzlik': 'Ледник',
  // Jurnal (curli apostrof normallashtiriladi -> to'g'ri ')
  "Foydalanuvchi qo'shdi": 'Добавил пользователя', "Foydalanuvchini o'chirdi": 'Удалил пользователя',
  'Kim nima qilgani — yangi amallar tepada. Oxirgi 500 ta amal saqlanadi.': 'Кто что сделал — новые действия сверху. Хранятся последние 500 действий.',
  'Jurnalni tozalash': 'Очистить журнал',
  // Ishchilar — bo'sh holat / placeholderlar
  'Avval "Lavozimlar" bo\'limidan lavozim qo\'shing.': 'Сначала добавьте должность в разделе "Должности".',
  'Avval "Qobiliyatlar" bo\'limidan qobiliyat qo\'shing.': 'Сначала добавьте навык в разделе "Навыки".',
  'Avval "Kamchiliklar" bo\'limidan kamchilik qo\'shing.': 'Сначала добавьте недостаток в разделе "Недостатки".',
  'Lavozim nomi (masalan: Operator)': 'Название должности (напр.: Оператор)',
  'Qobiliyat nomi (masalan: Payvandlash)': 'Название навыка (напр.: Сварка)',
  'Kamchilik nomi (masalan: Kechikish)': 'Название недостатка (напр.: Опоздание)',
  'Bunday qobiliyat bor': 'Такой навык уже есть', 'Bunday kamchilik bor': 'Такой недостаток уже есть',
  // Yo'qlama
  'Hammasi "Keldi" deb belgilandi': 'Все отмечены как "Пришёл"',
  'Avval "Ishchilar → Ro\'yxat" bo\'limidan ishchi qo\'shing': 'Сначала добавьте работника в разделе "Работники → Список"',
  "Avans qo'shildi": 'Аванс добавлен', "Avans o'chirildi": 'Аванс удалён', 'Jami avans': 'Всего аванс',
  'belgilanmagan': 'не отмечено',
  "Katakni bosib belgilang: bo'sh → Keldi → Yarim → Kelmadi → bo'sh.": 'Нажмите на ячейку: пусто → Пришёл → Половина → Не пришёл → пусто.',
  // Hisobot — Dashboard
  'Dashboard': 'Дашборд', 'Bugun': 'Сегодня', '7 kun': '7 дней', '30 kun': '30 дней', 'Shu oy': 'Этот месяц',
  "Sana oralig'i": 'Период дат', 'Dan': 'С', 'Gacha': 'По', 'Usta': 'Мастер', 'Barcha ustalar': 'Все мастера',
  "Excel'ga eksport": 'Экспорт в Excel', 'Davr tushumi': 'Доход за период',
  'Oylik tushum (6 oy)': 'Доход по месяцам (6 мес)', 'Kunlik tushum oqimi (14 kun)': 'Поток дохода по дням (14 дней)',
  'Holat taqsimoti': 'Распределение по статусу', "Ma'lumot yo'q": 'Нет данных', 'zakas': 'заказ',
  "To'lov holati": 'Статус оплаты', "Usta bo'yicha tushum": 'Доход по мастерам',
  "Eng ko'p sotilgan tovarlar": 'Самые продаваемые товары', 'Eng faol mijozlar': 'Самые активные клиенты',
  // Hisobot — Zakaslar/Ishchilar/Chek
  'Sotilgan tovarlar (jamlangan)': 'Проданные товары (сводно)', 'Miqdor': 'Кол-во', 'Marta': 'Раз',
  "Hali vaqt o'lchanmagan (zakaslarni \"Tayyor\" / \"Chiqib ketti\" qiling)": 'Время ещё не измерено (отметьте заказы "Готово" / "Отгружено")',
  'Ishga keldi': 'Пришёл на работу',
  "Ishchini tanlang — uning yo'qlama va avans amallari, hozirgi haqqi shu yerda ko'rinadi.": 'Выберите работника — его посещаемость, авансы и текущая зарплата появятся здесь.',
  "Hali amallar yo'q (yo'qlama yoki avans)": 'Пока нет операций (посещаемость или аванс)', 'Chek': 'Чек',
  'Ishchi hisoboti': 'Отчёт работника', 'Sana:': 'Дата:', "Amallar yo'q": 'Нет операций',
  'Jami ishlangan:': 'Всего отработано:', 'Jami avans:': 'Всего аванс:', 'Haqqi (qoldiq):': 'Зарплата (остаток):',
  // Narxlar
  'Nomi *': 'Название *', 'Chakana:': 'Розница:', 'Optom:': 'Опт:', 'Metri uchun:': 'За метр:',
  "Narx (so'm)": 'Цена (сум)',
};

// Kalitlarni normallashtirilgan ko'rinishga keltirib qo'yamiz (apostrof variantlari
// va lug'atdagi tasodifiy nomuvofiqliklarga chidamli bo'lishi uchun).
const RU_NORM = {};
for (const k in RU) RU_NORM[normApos(k).trim()] = RU[k];

function convert(text, lang) {
  if (lang === 'kr') return lotinToKrill(text);
  if (lang === 'ru') {
    const key = normApos(text).trim();
    const ru = RU_NORM[key];
    if (!ru) return text;
    // atrofdagi bo'sh joyni saqlab qolish
    const lead = text.match(/^\s*/)[0];
    const trail = text.match(/\s*$/)[0];
    return lead + ru + trail;
  }
  return text;
}

// ----- Global DOM qo'llovchi -----
let current = 'uz';
let observer = null;
const OBS = { subtree: true, childList: true, characterData: true };
const SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1 };

function processText(n, lang) {
  const p = n.parentNode;
  if (!p || SKIP[p.nodeName]) return;
  if (n._src == null) n._src = n.nodeValue;
  const out = lang === 'uz' ? n._src : convert(n._src, lang);
  if (n.nodeValue !== out) {
    try { n.nodeValue = out; } catch (e) { /* noop */ }
  }
}

function processPh(el, lang) {
  if (!el.getAttribute) return;
  const ph = el.getAttribute('placeholder');
  if (ph == null && el._phSrc == null) return;
  if (el._phSrc == null) el._phSrc = ph;
  const out = lang === 'uz' ? el._phSrc : convert(el._phSrc, lang);
  if (el.getAttribute('placeholder') !== out) {
    try { el.setAttribute('placeholder', out); } catch (e) { /* noop */ }
  }
}

function walkEl(root, lang, fresh) {
  // matn tugunlari
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) { if (fresh) n._src = n.nodeValue; processText(n, lang); }
  // placeholderlar
  if (root.querySelectorAll) {
    root.querySelectorAll('[placeholder]').forEach((el) => { if (fresh) el._phSrc = el.getAttribute('placeholder'); processPh(el, lang); });
  }
  if (root.nodeType === 1) processPh(root, lang);
}

function onMutations(muts) {
  if (current === 'uz') return;
  if (observer) observer.disconnect();
  for (const m of muts) {
    if (m.type === 'characterData') {
      const n = m.target;
      n._src = n.nodeValue; // React yangi (uz) matn yozdi
      processText(n, current);
    } else if (m.type === 'childList') {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 3) { node._src = node.nodeValue; processText(node, current); }
        else if (node.nodeType === 1) walkEl(node, current, true);
      });
    }
  }
  if (observer && document.body) observer.observe(document.body, OBS);
}

export function applyTil(lang) {
  current = lang;
  try { localStorage.setItem('til', lang); } catch (e) { /* noop */ }
  document.documentElement.setAttribute('lang', lang === 'ru' ? 'ru' : 'uz');
  if (!document.body) return;
  if (observer) observer.disconnect();
  walkEl(document.body, lang, false);
  if (lang !== 'uz') {
    if (!observer) observer = new MutationObserver(onMutations);
    observer.observe(document.body, OBS);
  }
}

export function getTil() {
  try { return localStorage.getItem('til') || 'uz'; } catch (e) { return 'uz'; }
}
