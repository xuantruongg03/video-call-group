# Stage 1: build done ngoài docker (hoặc nếu muốn build trong docker có thể thêm stage build)
# Stage 2: Serve with nginx
FROM nginx:stable-alpine
COPY ./dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
