# Halo Vocab

Halo Vocab 是一个本地优先的单词学习工具原型。

## 当前版本

- 每日新词数量可调，默认 20 个
- CSV / TXT 词表导入
- 中文释义 + 首次学习时通过 Free Dictionary API 加载英文词典解释（无 API Key；网络不可用时保留中文释义和 PDF 例句）
- 用户键入英文单词并判断拼写
- 错词自动进入复习列表
- 本地浏览器存储学习进度
- 英音式浏览器语音播放（使用系统 Speech Synthesis）
- 500 个词已内置例句和完形填空，默认开启，不需要 API
- OpenAI-compatible API 可作为内置内容的补充生成（默认预填 OpenRouter 免费路由）
- 设置页可分别关闭内置例句、内置完形填空和 AI 补充生成；“测试连接”会真实发起一次轻量请求
- 左上角音乐符号直接打开音乐页，使用 Audius 公共音乐搜索与在线播放
- 已导入 PDF 词表：严格整理为 500 个词、25 组，每组 20 个；初始显示第 1、2 组完成，第 3 组完成 10 个
- 本地 JSON 备份
- `word-selector.html` 提供 500 词、25 组的选择器，可导出已选词表 PDF
- 主界面已内置 500 词选择器，可直接在导航中选择并导出已选词表
- TOEFL PASS 可在设置中一键开启或关闭；双色浅色 / 深色模式可从顶部快捷按钮切换

首次打开会自动加载 PDF 词表。PDF 原文存在少量重复条目，解析到 512 个可识别条目后，应用按原顺序去掉前 12 个重复条目，得到 500 个词。

## 运行

直接双击 `index.html` 即可预览。当前原型不需要安装依赖。

CSV 建议格式：

```csv
word,中文释义,English definition
persist,坚持,to continue doing something despite difficulty
```

也支持使用 Tab 或 `|` 分隔的文本文件。

## 下一步

当前 Logo 使用 `assets/halo-logo.png`。音乐搜索使用 Audius 的公开只读接口；应用只做在线播放，不下载或重新分发歌曲。正式发布前仍应根据目标地区和歌曲来源核对版权与平台条款。

AI 设置建议：

- OpenRouter：API 地址填写 `https://openrouter.ai/api/v1`，模型填写 `openrouter/free`，再粘贴个人 API Key。
- 其他 OpenAI-compatible 服务：填写它的 `/v1` 地址、模型名和 Key 即可。
- 没有 API Key 时，拼写训练、中文释义、英文词典解释、内置例句和内置完形填空仍可使用；只会关闭 AI 补充生成。

## 桌面安装包

项目已加入 Electron 打包配置：

- Windows：`pnpm dist:win`，生成带安装向导的 `release/Halo-Vocab-0.1.0-Setup.exe`
- macOS：在 macOS 电脑执行 `pnpm dist:mac`，生成 `.dmg`，打开后拖入 Applications 即可安装

Windows 安装器采用非一键模式，用户可以选择安装目录，并自动创建桌面和开始菜单快捷方式。API Key 仍保存在本地应用存储中，正式发布时可以继续迁移到系统凭据存储。

### 没有 Mac 时生成 `.dmg`

项目内置了 GitHub Actions 工作流：`.github/workflows/build-macos.yml`。将项目上传到 GitHub 后，在仓库的 **Actions → Build Halo Vocab for macOS → Run workflow** 执行即可。GitHub 会在 macOS 云端机器上生成同时支持 Intel 和 Apple Silicon 的通用 `.dmg`，完成后从该次运行的 **Artifacts** 下载。

也可以推送版本标签自动构建：

```bash
git tag v0.1.0
git push origin v0.1.0
```

未配置 Apple Developer 签名证书时，macOS 首次打开可能需要在“系统设置 → 隐私与安全性”中允许打开；这不影响生成和使用安装包。
