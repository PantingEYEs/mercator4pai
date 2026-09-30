# Mercator4PAI

一个基于 WebGPU 的交互式圆柱纹理映射实验。项目将 `assets/Mercator.JPG` 作为输入纹理，在 GPU 上逐像素计算圆柱表面与纹理坐标之间的映射，并通过页面上的参数控件调整局部坐标系和圆柱角度。

## 功能概览

- 使用 WebGPU 绘制全屏矩形，并在 WGSL fragment shader 中完成逐像素映射。
- 加载 `3047 × 6831` 的 `assets/Mercator.JPG` 作为纹理。
- 通过 `X`、`Y`、`Z` 调整局部基向量的欧拉旋转，通过 `θ` 调整圆柱周向角度。
- 将无效投影区域显示为黑色；纹理采样使用线性过滤。
- 使用 Vite 提供本地开发服务器和生产构建。

## 环境要求

- Node.js `20.19+` 或 `22.12+`，以及 npm。
- 支持 WebGPU 的现代浏览器和可用的图形设备/驱动。
- 页面需要运行在安全上下文中。通过下方 Vite 开发服务器访问 `localhost` 即可。

如果浏览器没有提供 WebGPU，应用会在初始化时报告 `WebGPU adapter not available`，此时需要换用支持 WebGPU 的浏览器或设备。

## 快速开始

在仓库根目录执行：

```sh
npm ci
npm run dev
```

打开 Vite 输出的本地地址，通常是 `http://localhost:5173/`。

创建并预览生产构建：

```sh
npm run build
npm run preview
```

## 页面控件

| 控件 | 作用 |
| --- | --- |
| `X` | 调整局部坐标系的 X 方向欧拉角分量 |
| `Y` | 调整局部坐标系的 Y 方向欧拉角分量 |
| `Z` | 调整局部坐标系的 Z 方向欧拉角分量 |
| `θ` | 调整圆柱表面的周向角度偏移 |

当前控件采用周期值，显示范围为 `[-1, 1)`，输入步长为 `0.02`。输入超出范围时会回绕到该区间；每个 `0.02` 步长对应约 `3.6°` 的角度变化。修改数值会立即触发重绘。

## 渲染流程

1. TypeScript 初始化 WebGPU adapter、device、canvas context 和渲染管线。
2. CPU 端根据 `X`、`Y`、`Z` 计算正交局部基向量 `W`、`U`、`V`，并将它们和 `θ` 写入 uniform buffer。
3. 顶点着色器绘制覆盖画布的两个三角形，将屏幕坐标转换为与输入纹理尺寸相对应的采样坐标。
4. fragment shader 根据圆柱半径和角度构造表面点，归一化观察方向，再求其与竖直圆柱面的交点。
5. 交点的方位角和高度被转换为纹理 UV 坐标，并从 `Mercator.JPG` 采样颜色。落在有效投影范围之外的像素输出黑色。

当前着色器使用以下几何参数：纹理宽度为 `w = 3047`、高度为 `h = 6831`，圆柱半径为 `r = w / (2π)`。因此，替换纹理时需要同步检查 `shader.wgsl` 中的 `w`、`h`，以及 `main.ts` 顶点着色器输入坐标所用的纹理尺寸。

## 项目结构

```text
.
├── assets/
│   └── Mercator.JPG       # 主应用的输入纹理
├── main.ts                # WebGPU 初始化、控件处理和渲染调度
├── shader.wgsl            # 顶点与片元着色器、圆柱到纹理的映射
├── index.html             # 主应用页面和参数控件
├── globals.d.ts           # WebGPU 类型声明
├── package.json           # 根应用的开发、构建和预览脚本
└── my-webgpu-app/         # 独立的 Vite + TypeScript 示例模板
```

根目录是本项目主应用；在根目录运行 npm 命令即可。`my-webgpu-app/` 有自己的 `package.json` 和依赖，是单独保留的 Vite + TypeScript 起始模板，当前显示的是 Vite 计数器示例，不参与根目录应用的构建或启动。

## 开发说明

- 修改页面参数或 WebGPU 生命周期：编辑 `main.ts` 和 `index.html`。
- 修改投影、有效区域或纹理采样：编辑 `shader.wgsl`。
- 修改输入图像：替换 `assets/Mercator.JPG`，并确认图像尺寸与着色器常量一致。
- 根目录脚本：`npm run dev` 启动开发服务器，`npm run build` 构建，`npm run preview` 预览构建结果。

目前根目录 `package.json` 未配置自动化测试脚本。