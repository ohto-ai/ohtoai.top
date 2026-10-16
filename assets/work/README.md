# 项目截图

把截图放进这个目录，**以仓库名命名**，页面会自动接上 —— 不用改任何代码。

```
assets/work/PostLive.webp
assets/work/OpShop.webp
assets/work/MobEditor.webp
```

支持的扩展名按这个顺序查找：`.webp` → `.jpg` → `.png` → `.gif`。

## 尺寸建议

卡片会按不同宽高比裁切（16:10 / 4:5 / 1:1 / 16:9 循环），图片用
`object-fit: cover` 填充，所以**中心区域是安全区**。建议：

- 宽度 1200px 左右，短边至少 800px
- 重要内容别贴边 —— 不同宽高比裁切时边缘会被吃掉
- WebP 优先，单张控制在 200KB 以内

## 还没放图的仓库

会显示占位块：用该仓库的语言色淡淡铺一层，叠一层和全站同款的蓝图网格，
右下角是仓库名。是"设计过的空位"，不是坏图。

## 生效时机

- 本地预览：在 `repos.data.js` 里给对应条目填上 `"shot": "assets/work/xxx.webp"` 即可立即看到
- 线上：`.github/workflows/repos.yml` 每周一自动扫描本目录并提交。
  想立刻生效就去 Actions 里手动跑一次 `Update repository data`。
