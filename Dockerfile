# Image officielle Node en version Alpine : legere et suffisante pour une API Express
FROM node:24-alpine

# Repertoire de travail a l'interieur du conteneur
WORKDIR /app

# On copie d'abord les manifestes de dependances seuls.
# Docker met cette etape en cache : tant que package.json ne change pas,
# le npm ci n'est pas rejoue a chaque modification du code source.
COPY package*.json ./

# npm ci installe exactement les versions du package-lock.json,
# contrairement a npm install qui peut les faire deriver.
RUN npm ci --omit=dev

# On copie ensuite le reste du code source
COPY . .

# Port expose par l'application Express
EXPOSE 3000

CMD ["npm", "start"]
