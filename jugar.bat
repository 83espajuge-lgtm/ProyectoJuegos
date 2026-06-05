@echo off
echo Iniciando el servidor del juego...
start http://localhost:8000
python -m http.server 8000
