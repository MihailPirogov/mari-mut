# Марий мут — угадай марийское слово

**Марий мут** («Марийское слово», EN: *Mari Words*) — бесплатная игра в слова на марийском (луговомарийском) языке от [PirogovLab](https://pirogovlab.ru): угадайте загаданное слово за 6 попыток. Зелёная клетка — буква на своём месте, жёлтая — буква есть в слове, но в другом месте, серая — такой буквы нет.

- **Страница игры:** https://pirogovlab.ru/mari-mut-igra/ (EN: https://pirogovlab.ru/en/mari-mut-igra/)
- **Играть в браузере:** https://pirogovlab.ru/mari-wordle/
- **Политика конфиденциальности:** https://pirogovlab.ru/mari-wordle/privacy/
- Android-пакет: `ru.pirogovlab.mariwordle` (скоро в Google Play, RuStore и Яндекс Играх)

## Возможности
- Задача дня — одно слово для всех, новое каждый день в полночь по Москве; практика без ограничений.
- Слова от 3 до 8 букв, карточка слова после раунда (ударение, перевод на русский, пример).
- Общая таблица лидеров (сайт, Android, Яндекс Игры): «Сегодня», «Победы», «Серии»; участие по нику, без регистрации, удаление одной кнопкой.
- Клавиатура с Ӓ Ӧ Ӱ Ӹ Ҥ, физическая клавиатура на компьютере, интерактивное обучение, статистика, светлая/тёмная тема, высокий контраст, сложный режим, работа без интернета.

## Устройство репозитория
| Путь | Что это |
|---|---|
| `index.html`, `css/`, `js/app.js`, `js/sound.js` | игра (HTML5, без фреймворков; звук синтезируется WebAudio) |
| `js/platform.js`, `js/adapters/{yandex,android}.js` | платформенный слой: Яндекс Игры SDK (реклама, облачные сохранения, лидерборд) и Android-мост |
| `js/lb.js`, `server/index.php` | общая таблица лидеров: клиент с офлайн-очередью и PHP-API (JSON + flock, античит: сервер сам проверяет слово дня и каждую попытку) |
| `android/` | Android-оболочка (WebView + Yandex Mobile Ads: sticky-баннер, межстраничная, за вознаграждение) |
| `tools/` | сборки (`build_release.py yandex\|android\|web`, `build_android.sh`), данные, графика и трейлер для магазинов |
| `test/` | Playwright-тесты (логика, обучение, раскладка, лидерборд, Яндекс- и Android-сборки) |
| `store/` | тексты для магазинов, ответы для форм Google Play, иконка, графика и скриншоты |
| `site/privacy/` | политика конфиденциальности (RU/EN) |

## Сборка
```bash
python3 tools/build_words.py          # data/words.js, data/cards.js (нужны исходные словари, см. ниже)
python3 tools/build_lb_data.py        # server/words.json, server/bad_mhr.json
python3 tools/build_release.py web    # release/build/web
python3 tools/build_release.py yandex # release/mari-wordle-yandex.zip (Яндекс Игры)
bash tools/build_android.sh           # подписанные APK + AAB (нужен свой keystore.properties)
cd test && node test.js && node test_layout.js && node test_lb_ui.js && node test_api.js
```

**Словарные данные в репозиторий не входят.** Слова, переводы и примеры получены из «Марий йылме мутер» / «Словаря марийского языка» в 10 т. (МарНИИЯЛИ, 1990–2005; электронная версия — [dict.fu-lab.ru](https://dict.fu-lab.ru)) и «Марийско-русского словаря» В. М. Васильева и З. В. Учаева (2003); у этих источников нет открытой лицензии. Ключи подписи, пароли и скрипты выкладки тоже не публикуются.

## Лицензия
Код — MIT (см. `LICENSE`). Иконка, промо-графика и скриншоты — © PirogovLab.

---

**Mari Words** («Марий мут») is a free Mari-language word game by PirogovLab: guess the hidden word in six tries. Daily puzzle, practice mode, 3–8 letter words, word cards with Russian translations and a shared leaderboard. Web (HTML5), Android (WebView + Yandex Mobile Ads) and Yandex Games builds. Code is MIT; the dictionary data is not included.
