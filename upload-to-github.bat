@echo off
REM Первая загрузка проекта на GitHub (Windows). Использование: upload-to-github.bat ЛОГИН РЕПО
if "%~2"=="" ( echo Использование: upload-to-github.bat ЛОГИН РЕПО & exit /b 1 )
git init
git add -A
git commit -m "Мотивация: первая загрузка"
git branch -M main
git remote remove origin 2>nul
git remote add origin https://github.com/%~1/%~2.git
git push -u origin main
echo Готово. Включите Pages: Settings - Pages - Source: GitHub Actions. Сайт: https://%~1.github.io/%~2/
