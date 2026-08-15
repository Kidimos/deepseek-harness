# dsh-monokai

Monokai 动漫时钟皮肤。

## 特性

- 使用本地 `assets/clock-42.jpg` 作为背景图，打包为 data URL。
- 深色：经典 Monokai 配色。
- 浅色：独立暖白/纸张配色，不照搬深色。
- 通过 `body[data-dsh-monokai]` 直接覆盖 DSH 语义 token。
- 所有修改在插件卸载时自动还原。

## 安装

```sh
pnpm dsh plugin --profile web add ./plugins/dsh-monokai
pnpm dsh --profile web
```

## 构建

```sh
pnpm --dir plugins/dsh-monokai run build
```

## 文件

- `src/client/index.ts`：设置 body 标记和背景变量。
- `src/client/monokai.module.css`：浅色/深色皮肤 token。
- `src/client/background-art.generated.ts`：内嵌背景图 data URL。
- `skin.json`：皮肤元数据。
