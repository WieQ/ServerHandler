# Etap dev - frontend z hot reloadem
FROM node:20-alpine

WORKDIR /app

# Kopiujemy package.json i package-lock.json
COPY package*.json ./

# Instalujemy zależności
RUN npm install

# Kopiujemy resztę plików
COPY . .

# Włączamy hot reload z pollingiem (np. dla WSL2)
ENV CHOKIDAR_USEPOLLING=true

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
