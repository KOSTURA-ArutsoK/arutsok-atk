#!/bin/bash
set -e

echo "=========================================="
echo "  ArutsoK (ATK) - VPS Installation"
echo "  Verzia: 1.0.0"
echo "=========================================="

# -------- KONFIGURACIA - UPRAV PRED SPUSTENIM --------
GIT_REPO="https://github.com/ArutsoK/arutsok-atk.git"
DOMAIN="arutsok.sk"
DB_NAME="arutsok"
DB_USER="arutsok_user"
DB_PASS="ZMEN_TOTO_HESLO_123"
SESSION_SECRET="ZMEN_TOTO_NA_NAHODNY_RETAZEC_456"
APP_PORT=5000
APP_DIR="/var/www/arutsok"
# ------------------------------------------------------

if [ "$DB_PASS" = "ZMEN_TOTO_HESLO_123" ]; then
  echo "CHYBA: Uprav hesla v sekcii KONFIGURACIA na zaciatku skriptu!"
  echo "Spusti: nano $0"
  exit 1
fi

echo ""
echo "[1/7] Aktualizujem system..."
apt update && apt upgrade -y

echo ""
echo "[2/7] Instalujem Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo "  Node: $(node -v) | npm: $(npm -v)"

echo ""
echo "[3/7] Instalujem a konfigurujem PostgreSQL..."
if ! command -v psql &> /dev/null; then
  apt install -y postgresql postgresql-contrib
fi
systemctl enable postgresql
systemctl start postgresql

sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
sudo -u postgres psql -d $DB_NAME -c "GRANT ALL ON SCHEMA public TO $DB_USER;"
echo "  Databaza '$DB_NAME' pripravena."

echo ""
echo "[4/7] Instalujem PM2..."
npm install -g pm2

echo ""
echo "[5/7] Stahujem kod z GitHubu..."
mkdir -p $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR && git pull origin main
else
  git clone $GIT_REPO $APP_DIR
  cd $APP_DIR
fi

echo ""
echo "[6/7] Instalujem zavislosti, synchronizujem DB a buildujem..."
cd $APP_DIR
npm ci

export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"
export SESSION_SECRET="$SESSION_SECRET"
export NODE_ENV="production"
export PORT="$APP_PORT"

echo "  Synchronizujem databazove tabulky..."
npx drizzle-kit push

echo "  Buildujem aplikaciu..."
npm run build

cat > $APP_DIR/ecosystem.config.cjs << PMEOF
module.exports = {
  apps: [{
    name: 'arutsok',
    script: 'dist/index.cjs',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: $APP_PORT,
      DATABASE_URL: 'postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME',
      SESSION_SECRET: '$SESSION_SECRET'
    }
  }]
};
PMEOF

pm2 delete arutsok 2>/dev/null || true
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root
echo "  PM2 spusteny."

echo ""
echo "[7/7] Konfigurujem Nginx ako reverse proxy..."
apt install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/$DOMAIN << NGEOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    client_max_body_size 50M;
}
NGEOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
nginx -t && systemctl reload nginx

echo ""
echo "  Generujem SSL certifikat..."
certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos -m admin@$DOMAIN || \
  echo "  POZOR: SSL sa nepodarilo. Skontroluj DNS zaznamy."

echo ""
echo "=========================================="
echo "  INSTALACIA DOKONCENA!"
echo "=========================================="
echo ""
echo "  Web:       https://$DOMAIN"
echo "  Databaza:  postgresql://$DB_USER:***@localhost:5432/$DB_NAME"
echo "  Aplikacia: $APP_DIR"
echo "  PM2:       pm2 status | pm2 logs arutsok"
echo ""
echo "  Uzitocne prikazy:"
echo "    pm2 logs arutsok      - zobrazit logy"
echo "    pm2 restart arutsok   - restartovat aplikaciu"
echo "    cd $APP_DIR && git pull && npm ci && npm run build && pm2 restart arutsok  - aktualizacia"
echo "=========================================="
