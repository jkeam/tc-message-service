FROM node

WORKDIR /json-server

RUN npm install -g json-server

COPY services.json /json-server/

COPY middleware.js /json-server/

CMD ["json-server", "-p 3001", "services.json", "-m", "middleware.js"]

EXPOSE 3001
