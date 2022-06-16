FROM node:14-alpine
WORKDIR /usr/src/app
COPY package*.json yarn.lock ./
RUN yarn install
COPY ./ ./
EXPOSE 3000
CMD ["node", "bin/www"]

# by https://nodejs.org/en/docs/guides/nodejs-docker-webapp/
