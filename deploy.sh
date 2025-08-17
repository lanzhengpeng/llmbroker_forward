#!/bin/bash

# LLM Broker Forward 部署脚本
# 使用方法: ./deploy.sh [环境] [服务器地址]
# 示例: ./deploy.sh production user@your-server.com

set -e  # 遇到错误时退出

# 默认配置
ENVIRONMENT=${1:-production}
SERVER=${2:-""}
DEPLOY_PATH="/var/www/llmbroker_forward"
BACKUP_PATH="/var/backups/llmbroker_forward"

echo "🚀 开始部署 LLM Broker Forward..."
echo "环境: $ENVIRONMENT"
echo "服务器: $SERVER"
echo ""

# 1. 构建项目
echo "📦 构建项目..."
npm run build

if [ ! -d "dist" ]; then
    echo "❌ 构建失败，dist目录不存在"
    exit 1
fi

echo "✅ 构建完成"
echo ""

# 2. 检查构建产物
echo "🔍 检查构建产物..."
REQUIRED_FILES=("index.html" "sql-wasm.wasm" "db/config.db")

for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -e "dist/$file" ]; then
        echo "❌ 缺少必要文件: $file"
        exit 1
    fi
done

echo "✅ 构建产物检查通过"
echo ""

# 3. 本地部署（如果没有指定服务器）
if [ -z "$SERVER" ]; then
    echo "📍 本地部署模式"
    echo "请手动将 dist/ 目录的内容部署到你的Web服务器"
    echo "确保配置了SPA路由支持和WASM文件MIME类型"
    echo ""
    echo "Nginx配置示例: nginx.conf.example"
    echo "部署检查清单: DEPLOYMENT.md"
    exit 0
fi

# 4. 远程部署
echo "🌐 远程部署到: $SERVER"

# 创建备份
echo "💾 创建备份..."
ssh $SERVER "
    if [ -d '$DEPLOY_PATH' ]; then
        sudo mkdir -p $BACKUP_PATH
        sudo cp -r $DEPLOY_PATH $BACKUP_PATH/backup-$(date +%Y%m%d-%H%M%S)
        echo '备份创建完成'
    fi
"

# 上传文件
echo "📤 上传文件..."
rsync -avz --delete \
    --exclude='*.log' \
    --exclude='.git' \
    --exclude='node_modules' \
    dist/ $SERVER:$DEPLOY_PATH/

# 设置权限
echo "🔐 设置权限..."
ssh $SERVER "
    sudo chown -R www-data:www-data $DEPLOY_PATH
    sudo chmod -R 755 $DEPLOY_PATH
    sudo chmod 644 $DEPLOY_PATH/index.html
"

# 重启Web服务器（可选）
echo "🔄 重启Web服务器..."
ssh $SERVER "
    if systemctl is-active --quiet nginx; then
        sudo systemctl reload nginx
        echo 'Nginx已重新加载'
    elif systemctl is-active --quiet apache2; then
        sudo systemctl reload apache2
        echo 'Apache已重新加载'
    else
        echo '未检测到Nginx或Apache服务'
    fi
"

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 部署后检查清单:"
echo "1. 访问网站检查首页是否正常"
echo "2. 测试路由跳转 (/chat, /projects)"
echo "3. 检查API连接是否正常"
echo "4. 测试聊天功能"
echo "5. 检查项目展示功能"
echo ""
echo "如遇问题，请参考: DEPLOYMENT.md"
