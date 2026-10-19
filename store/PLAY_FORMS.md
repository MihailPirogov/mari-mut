# Марий мут — ответы для форм Google Play Console (и коротко для RuStore)

Приложение `ru.pirogovlab.mariwordle`, версия 1.0.0 (1), файл для загрузки `release/mari-wordle.aab`.
Политика конфиденциальности: **https://pirogovlab.ru/mari-wordle/privacy/** (EN: https://pirogovlab.ru/mari-wordle/privacy/en/).

Что приложение реально отправляет с устройства:
1. **Yandex Mobile Ads SDK 8.6.0** (баннер R-M-20243332-1, межстраничная R-M-20243332-2, за вознаграждение R-M-20243332-3). Отправляет рекламный идентификатор (в манифесте есть разрешение `com.google.android.gms.permission.AD_ID`) и технические данные для показа рекламы. Местоположение не отправляет: `locationConsent` не включён, разрешений на геолокацию нет.
2. **Общая таблица лидеров** на сервере разработчика `https://pirogovlab.ru/api/mari-wordle/` (HTTPS). Работает **только если игрок сам ввёл ник**. Отправляются ник, случайный идентификатор игрока и ключ (сгенерированы на устройстве; на сервере хранится только хеш ключа), а также результаты задачи дня. Удаляется кнопкой «Удалить меня из таблицы».
3. Ничего больше: нет аккаунтов, входа, аналитики разработчика, Firebase и покупок. Нет доступа к контактам, файлам, камере, микрофону и геолокации.

---

## 1. App content → Privacy policy
```
https://pirogovlab.ru/mari-wordle/privacy/
```

## 2. App content → Ads
**Contains ads: Yes** (Да, приложение содержит рекламу).

## 3. App content → App access
**All functionality is available without special access** (вход и коды не нужны).

## 4. App content → Advertising ID
- Does your app use advertising ID? **Yes**
- Purpose: **Advertising or marketing** (Yandex Mobile Ads SDK)

## 5. App content → Target audience and content
- Target age groups: **13–15, 16–17, 18 and over**. Не отмечать «до 13 лет».
  - Причина: при детской аудитории Google требует рекламные SDK, сертифицированные для программы Families. Yandex Mobile Ads в этот список не входит.
  - Содержание при этом подходит всем (0+).
- «Could your store listing unintentionally appeal to children?» Честный ответ: **No**.
  - Игра — словесная головоломка для взрослых и подростков, изучающих язык.
  - В оформлении нет мультперсонажей и детских образов.
- Если Google всё же отнесёт приложение к детским, нужно будет выключить рекламу для младших групп или сменить SDK. Сейчас этого не требуется.

## 6. App content → Data safety

**Обзор**
| Вопрос | Ответ |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data collected by your app encrypted in transit? | **Yes** (HTTPS/TLS: сервер таблицы лидеров и Yandex Mobile Ads SDK) |
| Which of the following methods of account creation does your app support? | **My app does not allow users to create an account** |
| Do you provide a way for users to request that their data be deleted? | **Yes**: кнопка «Удалить меня из таблицы» в игре и запрос через контакты в политике |
| Data deletion URL (если спросит) | `https://pirogovlab.ru/mari-wordle/privacy/` (раздел «Хранение и удаление данных») |

**Типы данных.** Отметить только эти четыре. Всё остальное: **не собирается**.

| Категория → тип | Collected | Shared | Обработка (ephemeral?) | Required / Optional | Цели |
|---|---|---|---|---|---|
| Personal info → **Name** (ник в таблице лидеров) | Yes | No | No (хранится на сервере) | **Optional** (игрок сам вводит ник) | **App functionality** |
| App activity → **Other actions** (результаты задачи дня: дата, длина, попытки, победа, введённые слова) | Yes | No | No | **Optional** (только при заданном нике) | **App functionality**, **Fraud prevention, security, and compliance** (сервер перепроверяет результат) |
| Device or other IDs → **Device or other IDs**: рекламный ID для Yandex Mobile Ads | Yes | **Yes**: Яндекс, рекламная сеть | No | **Optional**: пользователь может удалить или сбросить рекламный ID в настройках Android и отключить персонализацию (так рекомендует Яндекс) | **Advertising or marketing** |
| Device or other IDs → случайный ID игрока для таблицы лидеров. В форме это тот же пункт «Device or other IDs»: отметьте у него дополнительно цель App functionality | Yes | No | No | Optional | **App functionality** |

Итог по пункту **Device or other IDs**:
- Collected: Yes. Shared: Yes. Optional: Yes.
- Purposes for collection: Advertising or marketing; App functionality.
- Purposes for sharing: Advertising or marketing.

Не отмечать:
- Location (precise или approximate). Яндекс в инструкции к SDK пишет «No» при выключенном locationConsent.
- Email, User IDs, Financial, Health, Messages, Photos/Videos, Audio, Files, Calendar, Contacts, Web browsing.
- App info and performance: SDK по умолчанию не заявляет crash logs и diagnostics.
- App interactions, In-app search, Installed apps.

> Чем руководствовался: официальная таблица Яндекса «Data safety in Google Play» для Mobile Ads SDK 8 (ads.yandex.com/helpcenter/en/dev/android/app-privacy-android, проверено 19.10.2026). В ней из всех типов данных указан только «Device or other IDs → Yes» с целью Advertising.

## 7. App content → Content rating (анкета IARC)
- Email: mihail.pirogov@gmail.com · Category: **Game**.

| Вопрос | Ответ |
|---|---|
| Violence (any kind, cartoon/fantasy/realistic, blood) | **No** |
| Fear / horror | **No** |
| Sexuality, nudity | **No** |
| Language: profanity, crude humour | **No**. В игре нет ругательств; ники с матом отсекает фильтр сервера |
| Controlled substances (drugs, alcohol, tobacco) | **No** |
| Gambling, simulated gambling, loot boxes | **No** |
| Crude / discriminatory content | **No** |
| Does the app allow users to interact or exchange content with each other? | **Yes**: игроки видят ники друг друга в общей таблице лидеров. Переписки и чата нет; ники проходят фильтр, свои данные можно удалить |
| Does the app share the user's current physical location with other users? | **No** |
| Does the app allow purchases of digital goods? | **No** |
| Is the app a web browser or search engine / unrestricted internet access? | **No** |
| Does the app contain ads? (если спросит) | **Yes** |

Ожидаемый результат: **PEGI 3 / ESRB Everyone / USK 0 / IARC 3+**.
- Возможная пометка: «Users Interact» (из-за ников).
- Рекламу отдельной пометкой Google показывает сам («Contains ads»).

## 8. Прочие декларации App content
- News app: **No**. Government app: **No**.
- Financial features: **None**. Health: **None**.
- COVID-19 contact tracing: **No**.
- Foreground service / Full-screen intent / Exact alarms: **не используются**.
- Data deletion for accounts: не применимо, аккаунтов нет.

## 9. Store settings
- App or game: **Game** · Category: **Word**.
- Tags: Word, Puzzle, Casual, Single player, Offline.
- Contact details:
  - email mihail.pirogov@gmail.com;
  - website https://pirogovlab.ru. Нужен для app-ads.txt: в https://pirogovlab.ru/app-ads.txt уже есть строка `yandex.com, 1969132, DIRECT`.
- Countries: Россия + остальные по желанию. Стоимость: **Free**.

---

## RuStore: те же ответы, коротко
- Тип: **Игра**. Категории: основная **Словесные игры**, дополнительная **Головоломки**.
- Возрастная категория: **0+**.
- Реклама: **есть** (Рекламная сеть Яндекса). Платный контент: **нет**.
- Политика конфиденциальности: https://pirogovlab.ru/mari-wordle/privacy/
- Файл: `release/mari-wordle.apk` или `.aab`. Подпись та же, что у «Мут тӱня» (сертификат SHA-256 `17:C4:2A:46:…:93:9F`).

## Яндекс Игры: возраст и данные
- Возрастной рейтинг **0+**.
- Всё о рекламе и данных показывает платформа. Ссылки в игре не используются (п. 8.4.2); ссылки на политику нет.
- Запросы к API таблицы лидеров (`https://pirogovlab.ru/api/mari-wordle/`) — это fetch, а не ссылка. Ник вводится добровольно (п. 1.6.1.2).
