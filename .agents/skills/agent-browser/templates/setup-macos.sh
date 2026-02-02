#!/bin/bash
# agent-browser セットアップスクリプト（macOS用）
# 使い方: ./setup-macos.sh

set -e

INSTALL_DIR="${AGENT_BROWSER_INSTALL_DIR:-/tmp/agent-browser}"
VERSION="${AGENT_BROWSER_VERSION:-v0.7.6}"

echo "=== agent-browser セットアップ ==="
echo "インストール先: $INSTALL_DIR"
echo ""

# 1. 既存のインストールを削除
if [ -d "$INSTALL_DIR" ]; then
    echo "既存のインストールを削除中..."
    rm -rf "$INSTALL_DIR"
fi

# 2. ソースをクローン
echo "ソースをクローン中..."
git clone https://github.com/vercel-labs/agent-browser.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# 3. 依存関係をインストール
echo "依存関係をインストール中..."
if command -v pnpm &> /dev/null; then
    pnpm install
else
    npm install
fi

# 4. TypeScriptをビルド
echo "ビルド中..."
npm run build

# 5. Chromiumをインストール
echo "Chromiumをインストール中..."
npx playwright install chromium

# 6. アーキテクチャを確認してバイナリをダウンロード
ARCH=$(uname -m)
echo "アーキテクチャ: $ARCH"

if [ "$ARCH" = "x86_64" ]; then
    BINARY_NAME="agent-browser-darwin-x64"
elif [ "$ARCH" = "arm64" ]; then
    BINARY_NAME="agent-browser-darwin-arm64"
else
    echo "未対応のアーキテクチャ: $ARCH"
    exit 1
fi

# バイナリが存在しない場合はダウンロード
if [ ! -f "$INSTALL_DIR/bin/$BINARY_NAME" ]; then
    echo "バイナリをダウンロード中: $BINARY_NAME"
    curl -L -o "$INSTALL_DIR/bin/$BINARY_NAME" \
        "https://github.com/vercel-labs/agent-browser/releases/download/$VERSION/$BINARY_NAME"
    chmod +x "$INSTALL_DIR/bin/$BINARY_NAME"
fi

# 7. 動作確認
echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "使い方:"
echo "  cd $INSTALL_DIR && AGENT_BROWSER_HOME=$INSTALL_DIR ./bin/agent-browser <command>"
echo ""
echo "エイリアスを設定する場合（~/.bashrc または ~/.zshrc に追加）:"
echo "  alias agent-browser='AGENT_BROWSER_HOME=$INSTALL_DIR $INSTALL_DIR/bin/agent-browser'"
echo ""
echo "動作確認:"
cd "$INSTALL_DIR" && AGENT_BROWSER_HOME="$INSTALL_DIR" ./bin/agent-browser --version
