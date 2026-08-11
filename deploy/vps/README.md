# VPS 部署指南（Ubuntu/Debian 单机）

## 1. 准备域名与服务器

- 服务器开放端口：`22`（SSH）、`80`、`443`。
- DNS：`your-domain.com` → 服务器 IP；`api.your-domain.com` → 同一 IP。

## 2. 克隆并部署

```bash
git clone https://github.com/Tony1251/openmontage-saas /opt/openmontage-saas
cd /opt/openmontage-saas
bash deploy/vps/deploy.sh
```

首次运行会在缺少 `.env.production` 时从模板生成并退出（防止带默认密钥上线）。
编辑 `/opt/openmontage-saas/.env.production` 填好真实密钥后再跑一次：

```bash
bash deploy/vps/deploy.sh
```

脚本自动完成：`git pull` → 安装 Docker/Compose 插件 → `docker compose up -d --build`
→ `alembic upgrade head` → 冒烟测试。

## 3. nginx + TLS

```bash
sudo cp deploy/vps/nginx.conf /etc/nginx/sites-available/openmontage
sudo ln -s /etc/nginx/sites-available/openmontage /etc/nginx/sites-enabled/openmontage
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d api.your-domain.com
```

（把 `nginx.conf` 里的 `your-domain.com` 替换成真实域名。）

## 4. systemd 开机自启

```bash
sudo cp deploy/vps/openmontage.service /etc/systemd/system/openmontage.service
sudo systemctl daemon-reload
sudo systemctl enable --now openmontage
```

容器本身配了 `restart: unless-stopped`；该 unit 负责在宿主重启后拉起整栈。

## 5. 更新

```bash
bash deploy/vps/deploy.sh            # 拉代码 + 重建镜像 + 迁移 + 冒烟
sudo systemctl restart openmontage   # 或仅重启编排
```

## 6. 运维速查

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api web
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
curl https://api.your-domain.com/health
```

> 安全提示：`.env.production` 含真实密钥，切勿提交到 Git；nginx 仅监听
> `127.0.0.1:8000/3000`，公网流量全部走 nginx + TLS。
