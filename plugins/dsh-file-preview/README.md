# @dsh-external/dsh-client-ui-file-preview

文件树 + 预览工具插件，挂载到 dsh-toolbox 的 `toolbox.tool` 槽位。

- 在工具区图标栏显示文件树 SVG 图标
- 展开后左侧为文件树，右侧为文件预览
- 支持 Markdown / HTML / 代码 / diff / CSV / PDF / Office / 图片 / 文本等多格式预览
- 支持源码 / 预览 / 分屏三种模式
- 文本文件支持编辑并保存回工作区
- 通过 host 路由读取当前 session 工作目录：
  - `POST /dsh-file-preview/tree`
  - `POST /dsh-file-preview/read`
  - `POST /dsh-file-preview/write`
