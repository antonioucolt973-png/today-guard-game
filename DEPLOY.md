# 部署到 GitHub + Vercel

## 1. 在 Cocos Creator 构建 Web

1. 打开 `cocos-project/today-guard-game`。
2. 打开 `assets/scenes/BattleScene.scene`。
3. 使用 Cocos Creator 构建发布面板。
4. 平台选择 `Web Desktop` 或 `Web Mobile`。
5. 构建输出目录通常在：
   - `cocos-project/today-guard-game/build/web-desktop`
   - 或 `cocos-project/today-guard-game/build/web-mobile`

## 2. 准备 Vercel 静态目录

在仓库根目录创建：

```text
web-deploy/
```

把 Cocos Web 构建产物复制到 `web-deploy/`，确保：

```text
web-deploy/index.html
```

存在。

首次准备好 `web-deploy/` 后，需要把根目录 `.gitignore` 里最后的 `web-deploy/` 临时移除或改成只忽略旧构建缓存，再提交。

## 3. GitHub

把仓库推送到 GitHub。

建议不要上传：

- `library/`
- `temp/`
- `build/`
- `profiles/`
- `node_modules/`
- Codex 自动化与协作流程文件

当前 `.gitignore` 已经排除了这些内容。

## 4. Vercel

1. 在 Vercel 新建项目。
2. 导入 GitHub 仓库。
3. Root Directory 选择 `web-deploy`。
4. Framework Preset 选择 `Other`。
5. Build Command 留空。
6. Output Directory 留空或填 `.`。
7. Deploy。

## 5. 绑定阿里云域名

建议先绑定子域名：

```text
game.your-domain.com
```

在阿里云 DNS 添加 CNAME 到 Vercel 提示的目标地址。

如果绑定顶级域名，则按 Vercel 后台提示配置 A 记录或其他 DNS 记录。

