FROM nginx:1.27-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY config.js /usr/share/nginx/html/config.js
COPY src /usr/share/nginx/html/src
COPY styles /usr/share/nginx/html/styles
