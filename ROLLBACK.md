# 界面切换与回滚

本次更新保留原有 localStorage 键 `smallwins_records_v1`、`smallwins_nickname_v1` 与记录格式，更新和切换界面均不迁移、不清空数据。记录保存在访问产品的那个浏览器中；换设备或换浏览器不会自动同步。

## 随时使用旧界面

新版「设置 → 切换至旧版界面」，或打开 https://vitalu1107-beep.github.io/xiaochengji-pwa/legacy/ 。旧版顶部有「返回森林新版」。二者同源，共用记录。浏览器清理站点数据会同时影响两版，切换本身不会删除记录。

legacy 保留更新前的界面结构、样式和图标，增加返回新版提示、将 manifest 指向根目录、移除旧 Service Worker 注册，防止旧缓存策略干扰新版。旧版脚本也补上保存前读取最新数据、BFCache/跨页恢复同步、失败时保留草稿的保护，避免恢复旧页面后覆盖新版刚新增的记录。完全未经修改的原始代码仍在上述备份分支保留。

## 代码备份

更新前基线：`ebbf0b528c8deac697cb816149ae08c795cfea38`。

远程备份分支：`backup/pre-forest-ui-2026-11-02-ebbf0b5`。

查看：https://github.com/vitalu1107-beep/xiaochengji-pwa/tree/backup/pre-forest-ui-2026-11-02-ebbf0b5

## 整站恢复旧 UI

首选把根页面切换到当前 legacy 代码，并保留新版的可靠缓存机制，发布一个新提交。这样已安装的 PWA 也能安全接收旧界面，避免把历史 Service Worker 的清理策略带回来。

如确需恢复此次提交前的全部代码，在干净工作区执行 `git revert <森林UI发布提交SHA>`，检查变更后正常推送 main。不要强制回退分支或覆盖此后其他人的提交。GitHub Pages 发布完成后，在线刷新页面并等待 Service Worker 更新；可能需要再刷新一次。不要用「清除站点数据」作为更新步骤，它会删除本地记录。

新版缓存按完整发布安装，失败时旧 Worker 继续工作；不会自动刷新含未封存内容的页面。有新版提示时，先封存正文再刷新。

## 发布前验证

`node --test tests/*.test.cjs`。另需在浏览器中验证五页、旧版切换、保存后返回新版仍可读取，以及安装后离线互切。测试使用本地独立地址和测试记录，不操作用户线上记录。
