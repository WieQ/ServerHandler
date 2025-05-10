# 1. Wybieramy obraz bazowy (Python 3.9)
FROM python:3.9-slim

# 2. Ustalamy katalog roboczy w kontenerze
WORKDIR /app

# 3. Kopiujemy pliki aplikacji do kontenera
COPY . .

# 4. Instalujemy zależności
RUN pip install --no-cache-dir -r requirements.txt

# 5. Ekspozycja portu, na którym działa aplikacja
EXPOSE 5000

# Tworzymy plik start.sh
RUN echo '#!/bin/bash\nwhile true; do\n  echo "Server Działa"\n  sleep 5\ndone' > /app/start.sh

# Nadaj uprawnienia do wykonywania dla pliku start.sh
RUN chmod +x /app/start.sh

# 6. Uruchamiamy aplikację Flask
CMD ["python", "app.py"]
