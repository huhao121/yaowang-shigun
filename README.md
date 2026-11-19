# 妖王试棍

西游主题第三人称 3D 动作游戏原型：操控手持金箍棒的行者，在山门废墟中挑战石甲妖王。

- [在线试玩](https://huhao121.github.io/yaowang-shigun/yaowang/)
- [项目介绍和操作说明](https://huhao121.github.io/yaowang-shigun/)
- [项目报告](https://huhao121.github.io/yaowang-shigun/report/)
- [游戏源码与运行说明](source/README.md)

## 本地运行

需要 Node.js 和 pnpm：

```bash
cd source
pnpm install
pnpm dev
```

打开终端显示的本地地址；需要桌面浏览器、键盘和鼠标。模型资产位于 `source/public/assets/yaowang/`。

## 3D 模型资产

仓库已包含游戏实际使用的两个 GLB 模型，克隆仓库后即可在本地运行，无需另行下载：

| 资产 | 文件 | 内容 |
| --- | --- | --- |
| 行者 | [animated.glb](source/public/assets/yaowang/animated.glb)（约 17 MB） | Lux3D 生成的猴形角色，包含骨骼和重定向动作。 |
| 石甲妖王 | [model.glb](source/public/assets/yaowang/model.glb)（约 8.7 MB） | Lux3D 生成的 Boss 静态模型，游戏中通过程序驱动其运动。 |

这两个文件是 Git 中的实际模型文件，不是需要额外拉取的 Git LFS 指针。`source/public/assets/yaowang/` 是源码运行使用的路径；`yaowang/assets/yaowang/` 是线上试玩版使用的副本。金箍棒和场景由代码生成，见 [角色代码](source/src/player.js)和[场景代码](source/src/world.js)。

## 创作说明

行者和妖王的概念图经 Aholo Lux3D 生成三维模型；行者经过绑骨和动作重定向。场景、战斗逻辑和金箍棒为程序化制作。Boss 是静态网格，游戏攻击判定是手工设定的。此仓库是单场战斗原型，素材与动作的进一步使用应先核实相应授权。
