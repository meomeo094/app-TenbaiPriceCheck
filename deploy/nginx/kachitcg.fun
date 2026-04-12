# HTTP-only — dùng trước khi chạy certbot.
# Sau khi: sudo certbot --nginx -d kachitcg.fun
# Certbot sẽ tự thêm listen 443 ssl và redirect HTTP→HTTPS.
#
# Copy lên VPS:
#   sudo cp kachitcg.fun /etc/nginx/sites-available/kachitcg.fun
#   sudo ln -sf /etc/nginx/sites-available/kachitcg.fun /etc/nginx/sites-enabled/
#   sudo nginx -t && sudo systemctl reload nginx

server {
    listen 80;
    listen [::]:80;
    server_name kachitcg.fun www.kachitcg.fun;

    # API backend (Express, port 3001) — giữ nguyên path /api/...
    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        client_max_body_size 50m;
    }

    # Frontend (Next.js, port 3000)
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
    }
}
