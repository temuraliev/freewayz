# Автодеплой бота после git push

После настройки при каждом `git push` в ветку `main` сервер сам выполнит `git pull` и `pm2 restart admin-bot`.

---

## Однократная настройка

### 1. SSH-ключ для деплоя

**Где создавать:** на твоём компьютере (том, где ты работаешь в Cursor и делаешь git push). Не на сервере.

**Зачем:** GitHub Actions будет подключаться к серверу по SSH. Для этого нужен ключ: «приватная» часть хранится в секретах GitHub, «публичная» — на сервере.

---

#### Шаг 1.1 — Создать ключ на своём компьютере

Открой **PowerShell** или **Git Bash** (не сервер) и выполни:

**PowerShell (Windows):**
```powershell
# Папка для ключей (если нет — создастся)
mkdir $HOME\.ssh -Force
cd $HOME\.ssh
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_freewayz -N '""'
```

**Git Bash или Linux/Mac:**
```bash
mkdir -p ~/.ssh
cd ~/.ssh
ssh-keygen -t ed25519 -C "github-deploy" -f deploy_freewayz -N ""
```

Пароль вводить не нужно — просто Enter.

Появятся два файла в папке `.ssh`:
- `deploy_freewayz` — **приватный** ключ (никому не показывать, его содержимое — в GitHub Secrets)
- `deploy_freewayz.pub` — **публичный** ключ (его копируем на сервер)

---

#### Шаг 1.2 — Скопировать публичный ключ на сервер

**Вариант А — ты уже заходишь на сервер по SSH**

1. Открой файл `C:\Users\ТВОЙ_ЛОГИН\.ssh\deploy_freewayz.pub` в блокноте и скопируй всю строку (начинается с `ssh-ed25519`).
2. Зайди на сервер (PuTTY или `ssh root@IP_СЕРВЕРА`).
3. На сервере выполни (одной строкой подставь свой ключ вместо `ВСТАВЬ_КЛЮЧ`):
   ```bash
   mkdir -p ~/.ssh
   echo "ВСТАВЬ_КЛЮЧ" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```

**Вариант Б — с твоего компьютера, если установлен OpenSSH**

В PowerShell или Git Bash (подставь IP сервера):

```bash
type $HOME\.ssh\deploy_freewayz.pub | ssh root@IP_СЕРВЕРА "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

---

### 2. Секреты в GitHub

Репозиторий на GitHub → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

Создай три секрета:

| Name         | Откуда взять значение |
|--------------|------------------------|
| `DEPLOY_HOST`| IP или домен твоего сервера (например `123.45.67.89`). |
| `DEPLOY_USER`| Имя пользователя, под которым заходишь по SSH (часто `root`). |
| `DEPLOY_KEY` | Открой на своём компьютере файл **приватного** ключа (без .pub):<br>**Windows:** `C:\Users\ТВОЙ_ЛОГИН\.ssh\deploy_freewayz`<br>Скопируй **весь** текст от строки `-----BEGIN OPENSSH PRIVATE KEY-----` до `-----END OPENSSH PRIVATE KEY-----` (включительно) и вставь в значение секрета. |

Важно: в `DEPLOY_KEY` — именно файл **без** `.pub`, целиком, без лишних пробелов в начале и конце.

---

### 3. Проверка

Сделай любой коммит и пуш в `main`:

```bash
git add .
git commit -m "Deploy: test"
git push
```

Открой в репозитории вкладку **Actions**. Должен запуститься workflow **Deploy bot to server** и через минуту завершиться зелёным. На сервере после этого будет свежий код и перезапущенный бот.

---

## Если путь на сервере другой

Если проект лежит не в `/opt/freewayz`, отредактируй в файле `.github/workflows/deploy-bot.yml` строку:

```yaml
cd /opt/freewayz || exit 1
```

под свой путь и закоммить изменение.
