# GitHub Pages デプロイ設定

このプロジェクトはGitHub Actionsを使用してGitHub Pagesに自動デプロイされます。

## 設定手順

### 1. GitHub リポジトリの設定

1. GitHubリポジトリのページで「Settings」タブをクリック
2. 左サイドバーから「Pages」を選択
3. 「Source」で「GitHub Actions」を選択

### 2. 自動デプロイ

- `main`ブランチにプッシュすると自動的にデプロイが開始されます
- GitHub Actionsの「Actions」タブでデプロイの進行状況を確認できます
- デプロイが完了すると `https://[ユーザー名].github.io/sanjuan/` でアクセス可能になります

### 3. 手動デプロイ（オプション）

ローカルから手動でデプロイすることも可能です：

```bash
npm run deploy
```

## ファイル構成

- `.github/workflows/deploy.yml`: GitHub Actionsワークフロー
- `vite.config.ts`: Vite設定（base pathを含む）
- `package.json`: デプロイスクリプトを含む

## 注意点

- GitHub Pagesでは静的サイトのみホスト可能です
- Vite設定で適切なbase pathが設定されています（`/sanjuan/`）
- 初回デプロイ後、サイトが利用可能になるまで数分かかる場合があります