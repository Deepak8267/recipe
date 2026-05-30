@echo off
cd /d "%~dp0.."
set EXPO_OFFLINE=1
npx expo start --web --port 8124
