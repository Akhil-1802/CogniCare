FROM node:20-alpine

WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./
RUN npm install

COPY . .

# --host 0.0.0.0 is mandatory for Docker to expose the dev server
CMD [ "npm", "run", "dev", "--", "--host" ]
