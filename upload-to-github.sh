#!/usr/bin/env bash
# Первая загрузка проекта на GitHub (macOS / Linux). Использование: ./upload-to-github.sh ЛОГИН РЕПО
set -e
LOGIN="${1:?Укажите логин GitHub}"; REPO="${2:?Укажите имя репозитория}"
git init 2>/dev/null || true
git add -A
git commit -m "Мотивация: первая загрузка" || true
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/$LOGIN/$REPO.git"
git push -u origin main
echo "Готово. Включите Pages: Settings → Pages → Source: GitHub Actions. Сайт: https://$LOGIN.github.io/$REPO/"
