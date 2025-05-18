FROM python:3.9-slim

WORKDIR /app

COPY . .

RUN apt-get update && apt-get install -y procps dos2unix && \
    dos2unix /app/start.sh && chmod +x /app/start.sh && \
    pip install --no-cache-dir -r requirements.txt

ENV PYTHONUNBUFFERED=1

EXPOSE 5000

CMD ["hypercorn", "app:app", "--bind", "0.0.0.0:5000"]
