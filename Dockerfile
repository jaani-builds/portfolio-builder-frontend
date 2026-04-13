FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY index.html /usr/share/nginx/html/index.html
COPY preview.html /usr/share/nginx/html/preview.html
COPY config.js /usr/share/nginx/html/config.js
COPY assets /usr/share/nginx/html/assets
COPY src /usr/share/nginx/html/src
COPY styles /usr/share/nginx/html/styles

USER 101
