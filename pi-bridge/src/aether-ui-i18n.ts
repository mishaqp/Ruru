type JsonRecord = Record<string, unknown>;

const RU_TEXT: Readonly<Record<string, string>> = {
  // Common extension UI.
  "Advanced": "Расширенные настройки",
  "Agents": "Агенты",
  "All agents": "Все агенты",
  "Arguments": "Аргументы",
  "Async": "Асинхронно",
  "Auth": "Авторизация",
  "Auto": "Авто",
  "Close": "Закрыть",
  "Command": "Команда",
  "Compact": "Компактное",
  "Configuration": "Конфигурация",
  "Custom": "Пользовательское",
  "Default": "По умолчанию",
  "Direct": "Напрямую",
  "Dismiss": "Скрыть",
  "Environment": "Переменные среды",
  "Full": "Полное",
  "Group": "Группа",
  "Headers": "Заголовки",
  "Manage": "Управление",
  "Model": "Модель",
  "Models": "Модели",
  "No": "Нет",
  "None": "Нет",
  "Off": "Выкл.",
  "Prompts": "Промпты",
  "Provider": "Провайдер",
  "Reconnect": "Переподключить",
  "Resources": "Ресурсы",
  "Runtime": "Среда выполнения",
  "Smart": "Умный",
  "Tools": "Инструменты",
  "Transport": "Транспорт",
  "Yes": "Да",
  "Working directory": "Рабочий каталог",

  // Subagents.
  "Subagents": "Субагенты",
  "Subagent concurrency, dispatch, persistence, and Aether UI": "Параллельность, запуск, сохранение и интерфейс субагентов",
  "Max concurrency": "Макс. параллельность",
  "Maximum concurrent background agents. Queued agents start as slots free.": "Максимальное число одновременно работающих фоновых агентов. Агенты из очереди запускаются по мере освобождения слотов.",
  "Default max turns": "Лимит ходов по умолчанию",
  "Default maximum agentic turns before wrap-up. 0 means unlimited.": "Максимальное число ходов агента до завершения. 0 — без ограничений.",
  "Grace turns": "Дополнительные ходы",
  "Additional turns after the wrap-up steering message.": "Дополнительные ходы после сообщения о завершении.",
  "Nested depth": "Глубина вложенности",
  "Hard cap on nested delegation. Main is 0; 0 or 1 disables nesting.": "Максимальная глубина вложенного делегирования. Главный агент имеет уровень 0; значения 0 или 1 отключают вложенность.",
  "Join mode": "Режим объединения",
  "Default completion grouping for background agents.": "Способ группировки завершённых фоновых агентов по умолчанию.",
  "Scheduling": "Расписание",
  "Enable the schedule parameter and scheduled-job menu. Tool-spec changes apply on the next Pi session.": "Включить параметр расписания и меню запланированных задач. Изменения инструментов применятся в следующей сессии Pi.",
  "Output transcript": "Сохранять журнал",
  "Write each subagent .output transcript by default. Agent frontmatter can override this.": "По умолчанию сохранять журнал .output каждого субагента. Настройки самого агента могут это переопределить.",
  "Disable defaults": "Отключить встроенных",
  "Hide built-in general-purpose, Explore, and Plan agents. Custom agents are unaffected.": "Скрыть встроенных агентов general-purpose, Explore и Plan. Пользовательские агенты не затрагиваются.",
  "Fallback agent": "Резервный агент",
  "Agent used when subagent_type is unknown, disabled, or ambiguous. none rejects the call instead.": "Агент для случаев, когда subagent_type неизвестен, отключён или неоднозначен. Значение none отклоняет такой вызов.",
  "Strict agent files": "Строгая проверка файлов агентов",
  "Fail startup on an unreadable or unparseable agent .md file instead of skipping it.": "Останавливать запуск при нечитаемом или повреждённом .md-файле агента вместо его пропуска.",
  "Tool description": "Описание инструмента",
  "Agent tool description size/mode. Custom reads .pi/agent-tool-description.md.": "Размер и режим описания инструмента Agent. Пользовательский режим читает .pi/agent-tool-description.md.",
  "Scope models": "Ограничивать модели",
  "Validate subagent model choices against Pi scoped models (/scoped-models).": "Проверять выбранные модели субагентов по списку разрешённых моделей Pi (/scoped-models).",
  "Aether and Pi UI": "Интерфейс Ruru и Pi",
  "Widget": "Виджет",
  "Live Aether agent card visibility above the composer.": "Показывать карточку активного агента Ruru над полем ввода.",
  "Fleet view": "Список агентов",
  "Keep the TUI FleetView enabled for Pi CLI; Aether renders the same roster as tappable cards.": "Оставлять FleetView включённым в Pi CLI; Ruru показывает тот же список в виде интерактивных карточек.",
  "Agent mentions": "Упоминания агентов",
  "Route @handle messages to that agent. Model starts new agents through an off-screen clone; direct starts them immediately.": "Направлять сообщения @имя указанному агенту. Режим модели запускает нового агента через скрытую копию диалога, прямой режим — сразу.",
  "Remember agents": "Запоминать агентов",
  "Persist subagent sessions so @handle can resume them long after completion.": "Сохранять сессии субагентов, чтобы к ним можно было вернуться через @имя после завершения.",
  "Message this agent, then press Done": "Напишите этому агенту и нажмите «Готово»",
  "Subagent complete": "Субагент завершил работу",
  "Subagent result": "Результат субагента",
  "Subagent conversation": "Диалог субагента",
  "Agent types": "Типы агентов",
  "Enable or disable individual agent types. Disabled built-ins get a project stub; disabled custom agents keep their file.": "Включайте и отключайте отдельные типы агентов. Для отключённых встроенных агентов создаётся проектная заглушка; файлы пользовательских агентов сохраняются.",
  "Subagent Types": "Типы субагентов",
  "Enable, disable, and reload custom agent definitions": "Включение, отключение и перезагрузка пользовательских агентов",
  "Create agent definition": "Создать описание агента",
  "Add a prompt to the composer asking the main model to create .pi/agents/<name>.md.": "Добавить в поле ввода запрос основной модели на создание .pi/agents/<name>.md.",
  "Reload agent files": "Перезагрузить файлы агентов",
  "Re-read project, workspace, and personal agent definitions now.": "Повторно прочитать определения агентов проекта, рабочей области и пользователя.",
  "The pi-subagents Pi extension is not loaded.": "Расширение pi-subagents не загружено.",
  "Draft a subagent creation request": "Подготовить запрос на создание субагента",
  "Background only": "Только фоновые",

  // MCP adapter.
  "Standard I/O (command)": "Стандартный ввод-вывод (команда)",
  "Unix socket (rmcp-mux)": "Unix-сокет (rmcp-mux)",
  "Lazy (connect on first use)": "По требованию (подключаться при первом использовании)",
  "Eager (connect at session start)": "Сразу (подключаться при запуске сессии)",
  "Keep alive": "Поддерживать соединение",
  "Lazy, then keep alive": "По требованию, затем поддерживать соединение",
  "Legacy (default)": "Совместимый (по умолчанию)",
  "Auto (2026 with legacy fallback)": "Авто (2026 с резервным совместимым режимом)",
  "Auto (Streamable HTTP with SSE fallback)": "Авто (Streamable HTTP с резервным SSE)",
  "Auto (OAuth when available)": "Авто (OAuth при наличии)",
  "Use global setting": "Использовать общую настройку",
  "server (server__tool)": "сервер (server__tool)",
  "short (server_tool)": "короткое (server_tool)",
  "none (original name)": "без префикса (исходное имя)",
  "mcp (mcp__tool)": "mcp (mcp__tool)",
  "All as direct tools": "Все как прямые инструменты",
  "Proxy tool only": "Только proxy-инструмент",
  "Custom tool list": "Пользовательский список инструментов",
  "Authorization code (default)": "Код авторизации (по умолчанию)",
  "Authorization code": "Код авторизации",
  "Client credentials": "Учётные данные клиента",
  "New MCP server": "Новый MCP-сервер",
  "No MCP servers": "MCP-серверов нет",
  "Add HTTP or stdio servers to extend capabilities.": "Добавьте HTTP- или stdio-серверы, чтобы расширить возможности.",
  "MCP Runtime": "Среда MCP",
  "Server ID": "ID сервера",
  "Socket path": "Путь сокета",
  "Lifecycle": "Режим подключения",
  "Request timeout": "Тайм-аут запроса",
  "Configured Servers": "Настроенные серверы",
  "Tap any server to view details, inspect available tools, or reconnect.": "Нажмите на сервер, чтобы посмотреть сведения, доступные инструменты или переподключиться.",
  "MCP Servers": "MCP-серверы",
  "Manage MCP servers, inspect each transport config, and keep only the connections you want active.": "Управляйте MCP-серверами, проверяйте их транспорт и оставляйте активными только нужные подключения.",
  "Add MCP server": "Добавить MCP-сервер",
  "Runtime and OAuth": "Среда и OAuth",

  // Web Access.
  "Web search tools": "Инструменты веб-поиска",
  "Master switch for web search and source verification": "Главный переключатель веб-поиска и проверки источников",
  "Register search and source-check tools after the next extension reload.": "Зарегистрировать инструменты поиска и проверки источников после следующей перезагрузки расширений.",
  "Default search provider": "Провайдер поиска по умолчанию",
  "Used whenever a tool call leaves provider on Auto.": "Используется, когда для вызова инструмента выбран провайдер «Авто».",
  "Sequential fallback route": "Последовательный резервный маршрут",
  "Comma-separated providers in priority order. Saving a route clears the single-provider override and uses transient, quota, and network fallbacks by default.": "Провайдеры через запятую в порядке приоритета. Сохранение маршрута сбрасывает выбор одного провайдера и включает резервирование при временных, сетевых ошибках и исчерпании квоты.",
  "Result workflow": "Обработка результатов",
  "Review a draft, return an automatic summary, or return raw results.": "Проверять черновик, возвращать автоматическую сводку или исходные результаты.",
  "Summary review": "Проверка сводки",
  "Automatic summary": "Автоматическая сводка",
  "Raw results": "Исходные результаты",
  "Curator idle timeout": "Тайм-аут ожидания куратора",
  "Seconds before an idle review is submitted automatically.": "Через сколько секунд бездействия проверка будет отправлена автоматически.",
  "Open curator automatically": "Открывать куратор автоматически",
  "Open the review UI when a local search starts.": "Открывать интерфейс проверки при запуске локального поиска.",
  "Cloudflare AI Gateway key": "Ключ Cloudflare AI Gateway",
  "Credential for the Cloudflare AI Gateway when a Gemini gateway base URL is configured. Accepts a literal key, $CLOUDFLARE_API_KEY, or a !command source.": "Учётные данные Cloudflare AI Gateway при настроенном базовом URL Gemini gateway. Поддерживаются ключ, $CLOUDFLARE_API_KEY или источник !command.",
  "Summary model": "Модель сводки",
  "Optional provider/model id. Empty uses the best enabled model.": "Необязательный идентификатор провайдер/модель. Пустое значение использует лучшую включённую модель.",
  "Gemini search model": "Модель поиска Gemini",
  "Optional Gemini grounded-search model override.": "Необязательное переопределение модели Gemini для поиска с источниками.",
  "Base URL": "Базовый URL",
  "OpenAI search model": "Модель поиска OpenAI",
  "Optional model id for OpenAI Responses web search.": "Необязательный идентификатор модели для веб-поиска OpenAI Responses.",
  "xAI search model": "Модель поиска xAI",
  "Optional Grok model id for xAI hosted web search.": "Необязательный идентификатор модели Grok для веб-поиска xAI.",
  "SERPdive retrieval depth": "Глубина выдачи SERPdive",
  "Krill is the free tier; Mako and Moby consume paid credits.": "Krill — бесплатный уровень; Mako и Moby расходуют платные кредиты.",
  "Krill - free": "Krill — бесплатно",
  "Mako - focused": "Mako — точечно",
  "Moby - full content": "Moby — полный контент",
  "GitHub repository cloning": "Клонирование репозиториев GitHub",
  "Allow repository-aware extraction for GitHub URLs.": "Разрешить извлечение с учётом структуры репозитория для URL GitHub.",
  "GitHub clone size limit": "Лимит размера клонирования GitHub",
  "Repositories above this size use a lightweight API view.": "Для репозиториев больше этого размера используется облегчённое представление через API.",
  "GitHub clone timeout": "Тайм-аут клонирования GitHub",
  "Maximum seconds allowed for a repository clone.": "Максимальное время клонирования репозитория в секундах.",
  "GitHub clone cache path": "Путь кэша клонов GitHub",
  "Absolute runtime path for temporary repository clones.": "Абсолютный путь среды выполнения для временных копий репозиториев.",
  "YouTube understanding": "Анализ YouTube",
  "Extract transcripts and analyze videos when available.": "Извлекать расшифровки и анализировать видео, когда это возможно.",
  "YouTube model": "Модель YouTube",
  "Preferred Gemini model for transcript and video understanding.": "Предпочтительная модель Gemini для анализа расшифровок и видео.",
  "Local video analysis": "Анализ локального видео",
  "Allow supported local video files to be analyzed.": "Разрешить анализ поддерживаемых локальных видеофайлов.",
  "Local video model": "Модель локального видео",
  "Preferred Gemini model for local video analysis.": "Предпочтительная модель Gemini для анализа локального видео.",
  "Local video size limit": "Лимит размера локального видео",
  "Maximum local video upload size in MB.": "Максимальный размер загрузки локального видео в МБ.",
  "PDF size limit": "Лимит размера PDF",
  "Maximum PDF download size in MB.": "Максимальный размер загрузки PDF в МБ.",
  "Allow fresh Firecrawl requests": "Разрешить новые запросы Firecrawl",
  "Permit the configured Firecrawl server to fetch targets not already cached.": "Разрешить настроенному серверу Firecrawl загружать ещё не закэшированные адреса.",
  "Gemini browser cookies": "Cookie браузера для Gemini",
  "Allow read-only Chromium cookie discovery for Gemini Web.": "Разрешить чтение cookie Chromium для Gemini Web без их изменения.",
  "Chromium profile": "Профиль Chromium",
  "Optional profile name used for Gemini Web cookie discovery.": "Необязательное имя профиля для поиска cookie Gemini Web.",
  "Trust configured environment proxy": "Доверять proxy из окружения",
  "Skip hostname DNS preflight only when an HTTP(S) proxy applies.": "Пропускать предварительную DNS-проверку имени только при использовании HTTP(S)-proxy.",
  "Allowed proxy ranges": "Разрешённые диапазоны proxy",
  "Comma-separated CIDRs for narrow fake-IP or private proxy ranges.": "CIDR-диапазоны через запятую для узких fake-IP или частных proxy-сетей.",
  "Allowed fetch domains": "Разрешённые домены загрузки",
  "Optional comma-separated allowlist for fetch_content.": "Необязательный список разрешённых доменов для fetch_content через запятую.",
  "Blocked fetch domains": "Заблокированные домены загрузки",
  "Optional comma-separated denylist; deny rules take precedence.": "Необязательный список запрещённых доменов через запятую; запреты имеют приоритет.",
  "Firecrawl API version": "Версия API Firecrawl",
  "Use v1 only for older self-hosted deployments.": "Используйте v1 только для старых собственных развёртываний.",
  "Bright Data SERP zone": "Зона SERP Bright Data",
  "Required zone of Bright Data type serp for paid SERP search.": "Обязательная зона Bright Data типа serp для платного SERP-поиска.",
  "Bright Data Unlocker zone": "Зона Unlocker Bright Data",
  "Required zone of Bright Data type unblocker for the paid fetch fallback.": "Обязательная зона Bright Data типа unblocker для платного резервного получения страниц.",
  "Context Extraction": "Извлечение контекста",
  "GitHub, video, and PDF handling": "Обработка GitHub, видео и PDF",
  "Repository cloning, cache path, and size limits": "Клонирование репозиториев, путь кэша и ограничения размера",
  "Transcript and video understanding for YouTube and local files": "Анализ расшифровок и видео YouTube и локальных файлов",
  "PDF download limits": "Ограничения загрузки PDF",
  "Privacy and network": "Конфиденциальность и сеть",
  "Browser data access, SSRF exceptions, and fetch domain policy": "Доступ к данным браузера, исключения SSRF и правила загрузки доменов",
  "SSRF exceptions and fetch domain policy": "Исключения SSRF и правила загрузки доменов",
  "Default search provider, credentials, and base URLs": "Провайдер поиска по умолчанию, учётные данные и базовые URL",
  "Routing, review workflow, and summary model": "Маршрутизация, проверка результатов и модель сводки",
  "Web research": "Веб-исследование",
  "Web content ready": "Веб-контент готов",
  "Web access error": "Ошибка веб-доступа",
  "Search workflow": "Сценарий поиска",
  "Search workflow updated": "Сценарий поиска обновлён",
  "Gemini Web account": "Аккаунт Gemini Web",
  "Web Access": "Веб-доступ",
  "Search, source verification, extraction, and provider routing": "Поиск, проверка источников, извлечение контента и маршрутизация провайдеров",
  "Credential or base URL updated. Reload the Pi extension to apply it.": "Учётные данные или базовый URL изменены. Перезагрузите расширение Pi, чтобы применить изменения.",
  "Web Access setting saved. Reload the Pi extension to apply it.": "Настройка веб-доступа сохранена. Перезагрузите расширение Pi, чтобы применить изменение.",
  "Research on the web": "Исследовать в интернете",
  "Draft a multi-source research request": "Подготовить запрос с несколькими источниками",
  "Latest web activity": "Последняя веб-активность",
  "Searching the web": "Поиск в интернете",
  "Searched the web": "Поиск завершён",
  "Checking sources": "Проверка источников",
  "Checked sources": "Источники проверены",
  "Fetching web content": "Загрузка веб-контента",
  "Fetched web content": "Веб-контент загружен",
  "Reading web content": "Чтение веб-контента",
  "Read web content": "Веб-контент прочитан",
};

/**
 * Presentation-only additions. These strings are rendered by bundled extension
 * settings/cards/surfaces. They deliberately do not include tool ids, command
 * names, provider/model ids, paths, URLs, persisted option values or schemas.
 */
const RU_EXTRA_TEXT: Readonly<Record<string, string>> = {
  // Common live UI.
  "Add server": "Добавить сервер",
  "Authentication": "Аутентификация",
  "Conversation": "Диалог",
  "Name": "Имя",
  "No conversation available.": "Диалог недоступен.",
  "No conversation available yet.": "Диалог пока недоступен.",
  "No output.": "Нет результата.",
  "Result": "Результат",
  "Status": "Статус",
  "Stop": "Остановить",
  "Stop agent": "Остановить агента",
  "Subagent": "Субагент",
  "Subagent activity": "Активность субагента",
  "Subagent unavailable": "Субагент недоступен",
  "View": "Открыть",

  // Subagent tool-card titles.
  "Running subagent": "Запуск субагента",
  "Ran subagent": "Субагент завершён",
  "Checking subagent result": "Проверка результата субагента",
  "Checked subagent result": "Результат субагента проверен",
  "Steering subagent": "Управление субагентом",
  "Steered subagent": "Субагент направлен",

  // MCP form and management UI.
  "2026-07-28 only": "Только 2026-07-28",
  "Bearer token": "Bearer-токен",
  "Bearer token env var": "Переменная среды Bearer-токена",
  "HTTP headers": "HTTP-заголовки",
  "HTTP transport": "HTTP-транспорт",
  "OAuth grant type": "Тип OAuth grant",
  "OAuth client ID": "ID клиента OAuth",
  "OAuth client secret": "Секрет клиента OAuth",
  "OAuth scopes": "Области доступа OAuth",
  "OAuth redirect URI": "URI перенаправления OAuth",
  "OAuth client name": "Имя клиента OAuth",
  "OAuth client URI": "URI клиента OAuth",
  "OAuth logo URL": "URL логотипа OAuth",
  "Skip OAuth issuer validation": "Пропустить проверку issuer OAuth",
  "OAuth authorization params": "Параметры авторизации OAuth",
  "Per-request headers command": "Команда заголовков для каждого запроса",
  "Idle timeout (minutes)": "Тайм-аут простоя (минуты)",
  "Request timeout (ms)": "Тайм-аут запроса (мс)",
  "MCP protocol era": "Версия протокола MCP",
  "Expose resources": "Показывать ресурсы",
  "Direct tools": "Прямые инструменты",
  "Custom direct tools": "Пользовательские прямые инструменты",
  "Tool prefix": "Префикс инструментов",
  "Include tools": "Включить инструменты",
  "Exclude tools": "Исключить инструменты",
  "Search keywords": "Ключевые слова поиска",
  "Require approval": "Требовать подтверждение",
  "Custom approval tools": "Инструменты с пользовательским подтверждением",
  "Show stderr": "Показывать stderr",
  "Protocol trace": "Трассировка протокола",
  "Disabled": "Отключён",
  "Rename to": "Переименовать в",
  "Rename server": "Переименовать сервер",
  "Authenticate (OAuth)": "Авторизоваться (OAuth)",
  "Clear OAuth credentials": "Очистить данные OAuth",
  "Remove server": "Удалить сервер",
  "MCP OAuth": "MCP OAuth",
  "Open authorization URL": "Открыть URL авторизации",
  "Callback URL or authorization code": "Callback URL или код авторизации",
  "Complete OAuth": "Завершить OAuth",

  // MCP descriptions.
  "Executable for the stdio transport, for example npx or uvx.": "Исполняемая команда для stdio-транспорта, например npx или uvx.",
  "One argument per line. Environment interpolation is supported.": "Один аргумент на строку. Поддерживается подстановка переменных среды.",
  "JSON object such as {\"API_KEY\": \"$ENV_VAR\"}. A value beginning with ! runs a command when the server connects.": "JSON-объект, например {\"API_KEY\": \"$ENV_VAR\"}. Значение, начинающееся с !, запускает команду при подключении сервера.",
  "Optional. Supports ${VAR}, $env:VAR, and ~.": "Необязательно. Поддерживаются ${VAR}, $env:VAR и ~.",
  "HTTP MCP endpoint. Supports Streamable HTTP and legacy SSE.": "HTTP endpoint MCP. Поддерживает Streamable HTTP и legacy SSE.",
  "Force a transport or let the adapter auto-negotiate.": "Выберите транспорт принудительно или разрешите адаптеру определить его автоматически.",
  "OAuth is auto-detected by default unless custom headers are configured.": "По умолчанию OAuth определяется автоматически, если не настроены пользовательские заголовки.",
  "Optional static token. Supports ${VAR}, $env:VAR, and !command sources.": "Необязательный статический токен. Поддерживаются ${VAR}, $env:VAR и источники !command.",
  "Optional environment variable containing the bearer token.": "Необязательная переменная среды с Bearer-токеном.",
  "JSON object such as {\"Authorization\": \"Bearer ${TOKEN}\"}.": "JSON-объект, например {\"Authorization\": \"Bearer ${TOKEN}\"}.",
  "Client credentials completes without opening a browser.": "Client credentials завершается без открытия браузера.",
  "Optional pre-registered client ID. Dynamic registration is used when empty.": "Необязательный заранее зарегистрированный ID клиента. Если поле пустое, используется динамическая регистрация.",
  "Optional confidential-client secret. A leading ! runs a command.": "Необязательный секрет confidential-client. Начальный ! запускает команду.",
  "Space-separated scopes requested from the authorization server.": "Области доступа, запрашиваемые у сервера авторизации, через пробел.",
  "Exact pre-registered localhost callback, including port and path.": "Точный заранее зарегистрированный localhost callback, включая порт и путь.",
  "Client display name advertised during dynamic registration.": "Отображаемое имя клиента при динамической регистрации.",
  "Client homepage advertised during dynamic registration.": "Домашняя страница клиента при динамической регистрации.",
  "Absolute http(s) logo URL advertised during dynamic registration.": "Абсолютный http(s) URL логотипа при динамической регистрации.",
  "Security-weakening escape hatch for known-misconfigured authorization servers.": "Ослабляющий проверку параметр для заведомо некорректно настроенных серверов авторизации.",
  "Optional JSON object of extra authorization URL parameters.": "Необязательный JSON-объект дополнительных параметров URL авторизации.",
  "Optional JSON object { \"command\": \"...\", \"args\": [...] }. Derives fail-closed headers for every HTTP request.": "Необязательный JSON-объект { \"command\": \"...\", \"args\": [...] }. Формирует fail-closed заголовки для каждого HTTP-запроса.",
  "Explicit rmcp-mux Unix-domain socket. Supports ${VAR}, $env:VAR, and ~.": "Явный Unix-domain socket rmcp-mux. Поддерживаются ${VAR}, $env:VAR и ~.",
  "When the server process or HTTP session is connected.": "Когда подключается процесс сервера или HTTP-сессия.",
  "Minutes before idle disconnect. Empty uses the global setting, 0 disables idle timeout.": "Минуты до отключения при простое. Пустое значение использует общую настройку, 0 отключает тайм-аут простоя.",
  "Milliseconds before live requests time out. Empty or 0 uses the SDK default.": "Миллисекунды до тайм-аута активного запроса. Пустое значение или 0 использует значение SDK по умолчанию.",
  "Legacy is the default. Auto offers 2026-07-28 with legacy fallback.": "По умолчанию используется legacy. Auto предлагает 2026-07-28 с резервным legacy-режимом.",
  "Expose MCP resources as callable tools.": "Предоставлять ресурсы MCP как вызываемые инструменты.",
  "Register tools individually instead of routing through the mcp proxy tool.": "Регистрировать инструменты отдельно вместо маршрутизации через proxy-инструмент mcp.",
  "Tool names, one per line or a JSON array. Used only when Custom is selected above.": "Имена инструментов: по одному на строку или JSON-массив. Используется только при выборе «Пользовательское» выше.",
  "Prefix style for tools exposed by this server.": "Стиль префикса инструментов, предоставляемых этим сервером.",
  "Optional tool names or glob patterns. Empty includes all tools.": "Необязательные имена инструментов или glob-шаблоны. Пустое значение включает все инструменты.",
  "Optional tool names or glob patterns to hide after includeTools.": "Необязательные имена инструментов или glob-шаблоны, скрываемые после includeTools.",
  "Optional JSON object such as {\"list_issues\": [\"github\", \"issues\"]}.": "Необязательный JSON-объект, например {\"list_issues\": [\"github\", \"issues\"]}.",
  "Require interactive approval before calling matching tools.": "Требовать интерактивное подтверждение перед вызовом подходящих инструментов.",
  "Show the server's stderr in the Pi session log.": "Показывать stderr сервера в журнале сессии Pi.",
  "Enable metadata-only JSONL protocol tracing for this server.": "Включить для этого сервера трассировку протокола JSONL только с метаданными.",
  "Keep this server configured but prevent connections and tool calls.": "Сохранить конфигурацию сервера, но запретить подключения и вызовы инструментов.",
  "Runtime status reported by the Pi extension.": "Статус среды выполнения, сообщаемый расширением Pi.",
  "This server is disabled.": "Этот сервер отключён.",
  "Switching transport clears the previous transport-specific fields.": "Смена транспорта очищает поля, относящиеся к предыдущему транспорту.",
  "Type the new name, then tap Rename server.": "Введите новое имя и нажмите «Переименовать сервер».",
  "Rename this server and keep its configuration.": "Переименовать сервер, сохранив его конфигурацию.",
  "Close and reconnect this server without reloading Pi.": "Закрыть соединение и переподключить сервер без перезагрузки Pi.",
  "Start or continue the OAuth flow for this server.": "Начать или продолжить OAuth для этого сервера.",
  "Remove stored OAuth credentials and close the connection.": "Удалить сохранённые данные OAuth и закрыть соединение.",
  "Remove this server from the Pi MCP config.": "Удалить этот сервер из конфигурации Pi MCP.",
  "Unique server name used as the config key and default tool prefix.": "Уникальное имя сервера, используемое как ключ конфигурации и префикс инструментов по умолчанию.",
  "All transports supported by the MCP adapter.": "Все транспорты, поддерживаемые MCP-адаптером.",
  "Write this server to the Pi MCP config, then reload to connect.": "Записать сервер в конфигурацию Pi MCP, затем перезагрузить для подключения.",
  "Open the authorization URL, approve access, then paste the full callback URL or code back here.": "Откройте URL авторизации, разрешите доступ, затем вставьте сюда полный callback URL или код.",
  "The browser may not be able to reach the localhost callback from another device; paste the redirect URL manually below.": "Браузер на другом устройстве может не открыть localhost callback; вставьте URL перенаправления вручную ниже.",
  "Paste the full URL from the browser address bar after approving access.": "После разрешения доступа вставьте полный URL из адресной строки браузера.",
  "Exchange the authorization code and reconnect the server.": "Обменять код авторизации и переподключить сервер.",

  // MCP tool-card titles.
  "Calling MCP": "Вызов MCP",
  "Called MCP": "Вызов MCP завершён",
  "Running MCP script": "Запуск MCP-скрипта",
  "Ran MCP script": "MCP-скрипт завершён",

  // Web Access additions.
  "Pick a specific provider above to configure its API key, base URL, and provider-specific options.": "Выберите конкретного провайдера выше, чтобы настроить его API-ключ, базовый URL и специальные параметры.",
};

const PRESENTATION_KEYS = new Set([
  "title",
  "subtitle",
  "label",
  "description",
  "placeholder",
  "message",
  "text",
  "buttonLabel",
  "running_title",
  "completed_title",
  "pill",
  "badge",
  "tag",
  "resultText",
]);

function currentLanguage(hostContext: JsonRecord): string {
  const direct = typeof hostContext.language === "string" ? hostContext.language : "";
  const settings = hostContext.settings;
  const nested = settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as JsonRecord).language
    : undefined;
  return direct || (typeof nested === "string" ? nested : "");
}

function russianPlural(count: number, one: string, few: string, many: string): string {
  const value = Math.abs(Math.trunc(count));
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = value % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function translateStatus(status: string): string | undefined {
  const normalized = status.toLowerCase();
  const statuses: Readonly<Record<string, string>> = {
    "ready": "готов",
    "not initialized": "не инициализирован",
    "not initialized yet": "ещё не инициализирован",
    "connected": "подключён",
    "failed": "ошибка",
    "auth required": "требуется авторизация",
    "needs auth": "требуется авторизация",
    "needs-auth": "требуется авторизация",
    "not connected": "не подключён",
    "not-connected": "не подключён",
    "running": "выполняется",
    "queued": "в очереди",
    "completed": "завершён",
    "stopped": "остановлен",
    "aborted": "прерван",
    "steered": "направлен",
    "error": "ошибка",
    "enabled": "включён",
    "disabled": "отключён",
  };
  return statuses[normalized];
}

function translateDynamicText(value: string): string | undefined {
  let match: RegExpMatchArray | null;

  match = value.match(/^([●▲○✓✗]\s*|🔑\s*)?(connected|failed|auth required|needs auth|needs-auth|not connected|not-connected|running|queued|completed|stopped|aborted|steered|error)$/i);
  if (match) {
    const translated = translateStatus(match[2]);
    return translated ? `${match[1] ?? ""}${translated}` : undefined;
  }

  match = value.match(/^(\d+) tools$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "инструмент", "инструмента", "инструментов")}`;
  }
  match = value.match(/^(\d+) tool uses$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "вызов инструмента", "вызова инструмента", "вызовов инструментов")}`;
  }
  match = value.match(/^(\d+) turns$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "ход", "хода", "ходов")}`;
  }
  match = value.match(/^(\d+) tokens$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "токен", "токена", "токенов")}`;
  }
  match = value.match(/^(\d+) sources$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "источник", "источника", "источников")}`;
  }
  match = value.match(/^(\d+) results$/);
  if (match) {
    const count = Number(match[1]);
    return `${count} ${russianPlural(count, "результат", "результата", "результатов")}`;
  }
  match = value.match(/^(\d+)\/(\d+) queries$/);
  if (match) return `${match[1]}/${match[2]} запросов`;

  match = value.match(/^(\d+) running · (\d+) queued$/);
  if (match) return `Выполняется: ${match[1]} · в очереди: ${match[2]}`;
  match = value.match(/^(\d+) more agents?$/);
  if (match) {
    const count = Number(match[1]);
    return `Ещё ${count} ${russianPlural(count, "агент", "агента", "агентов")}`;
  }

  match = value.match(/^(\d+) servers? configured · (\d+) connected · (\d+) tools$/);
  if (match) {
    const servers = Number(match[1]);
    const connected = Number(match[2]);
    const tools = Number(match[3]);
    return `${servers} ${russianPlural(servers, "сервер настроен", "сервера настроено", "серверов настроено")} · подключено: ${connected} · ${tools} ${russianPlural(tools, "инструмент", "инструмента", "инструментов")}`;
  }
  match = value.match(/^Reload \((\d+) servers?\)$/);
  if (match) {
    const count = Number(match[1]);
    return `Перезагрузить (${count} ${russianPlural(count, "сервер", "сервера", "серверов")})`;
  }
  match = value.match(/^Reconnect all \((\d+) active\)$/);
  if (match) return `Переподключить все (активно: ${match[1]})`;

  match = value.match(/^Status: (.+?)(?: (\d+)s ago)?$/);
  if (match) {
    const status = translateStatus(match[1]) ?? match[1];
    return match[2] ? `Статус: ${status} · ${match[2]} с назад` : `Статус: ${status}`;
  }

  match = value.match(/^Pi MCP bridge is (ready|not initialized|not initialized yet)\. Config: (.+)$/);
  if (match) return `Мост Pi MCP ${translateStatus(match[1]) ?? match[1]}. Конфигурация: ${match[2]}`;
  match = value.match(/^Pi MCP bridge is (ready|not initialized|not initialized yet)\. Config file: (.+)$/);
  if (match) return `Мост Pi MCP ${translateStatus(match[1]) ?? match[1]}. Файл конфигурации: ${match[2]}`;
  match = value.match(/^Writes to (.+)$/);
  if (match) return `Записывает в ${match[1]}`;
  match = value.match(/^Authorize (.+)$/);
  if (match) return `Авторизовать ${match[1]}`;

  match = value.match(/^Default provider and (.+) configuration\. Credentials are persisted in the existing Pi config file\.$/);
  if (match) return `Провайдер по умолчанию и настройки ${match[1]}. Учётные данные сохраняются в существующем файле конфигурации Pi.`;

  match = value.match(/^Calling (.+)$/);
  if (match) return `Вызов ${match[1]}`;
  match = value.match(/^Called (.+)$/);
  if (match) return `Вызов ${match[1]} завершён`;

  return undefined;
}

/** Localize one presentation string without mutating runtime data. */
export function localizeAetherUiText(value: string, hostContext: JsonRecord): string {
  if (!currentLanguage(hostContext).toLowerCase().startsWith("ru")) return value;
  return translateText(value);
}

function translateText(value: string): string {
  const exact = RU_EXTRA_TEXT[value] ?? RU_TEXT[value];
  if (exact) return exact;
  const trimmed = value.trim();
  const translated = RU_EXTRA_TEXT[trimmed] ?? RU_TEXT[trimmed] ?? translateDynamicText(trimmed);
  if (!translated || trimmed === value) return translated ?? value;
  return value.replace(trimmed, translated);
}

function localizeValue(value: unknown, key = ""): unknown {
  if (Array.isArray(value)) return value.map((entry) => localizeValue(entry));
  if (value && typeof value === "object") {
    const result: JsonRecord = {};
    for (const [childKey, childValue] of Object.entries(value as JsonRecord)) {
      result[childKey] = localizeValue(childValue, childKey);
    }
    return result;
  }
  if (typeof value === "string" && PRESENTATION_KEYS.has(key)) {
    return translateText(value);
  }
  return value;
}

/**
 * Localizes only the presentation snapshot sent to Ruru UI. Pi tool names,
 * schemas, prompts, persisted extension values, action ids and provider/model
 * identifiers are intentionally left untouched so localization cannot change
 * agent behaviour.
 */
export function localizeAetherUiSnapshot<T>(snapshot: T, hostContext: JsonRecord): T {
  if (!currentLanguage(hostContext).toLowerCase().startsWith("ru")) return snapshot;
  return localizeValue(snapshot) as T;
}
