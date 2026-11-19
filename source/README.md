# 妖王 · 重制版

山门废墟里的第三人称魂系 Boss 战切片。Vite + three.js，全部美术由程序化几何、本地 GLB 和 WebAudio 合成音组成，不依赖 CDN。

## 启动

```bash
pnpm install
pnpm dev --port 8201 --host 127.0.0.1
```

打开 <http://127.0.0.1:8201/>。标题页点击「入山迎战」一次进入。

```bash
pnpm build   # 生产构建
pnpm shots   # Playwright + 本机 Chrome 生成 artifacts/
```

## 操作

| 按键 | 动作 |
| --- | --- |
| `W A S D` | 移动 |
| `Shift` | 疾跑（消耗体力） |
| `Space` | 闪避（有无敌帧） |
| `J` / 鼠标左键 | 轻击三段（带输入缓冲与攻击吸附） |
| `K` | 重击 |
| `L` | 弹反（约 0.26 秒窗口） |
| `Tab` | 锁定 / 解除锁定 |
| `Q` | 定身法术（12 秒冷却） |
| `R` | 饮酒回血（3 次） |
| `Enter` | 标题页开始 / 结算页再战 |
| `Esc` | 释放鼠标（游戏内点击开始后会请求指针锁定） |

## 调试钩子与 URL 参数

`window.G`：

- `G.ready`、`G.state()`
- `G.start()`
- `G.press(key)` / `G.release(key)`
- `G.step(n, dt)`
- `G.setGod(true|false)`
- `G.forceResult(true|false)`
- `G.pauseOnNextHit()`（QA 截图用：命中后短暂延迟冻结）
- `G.setBossHp(n)` / `G.setPlayerHp(n)` / `G.phase2()`

URL：

- `?auto=1` 跳过标题进入战斗；内置定时器会持续接近、攻击并在 Boss 出手时闪避。
- `?god=1` 玩家无敌，便于观察招式。
- `?demo=combat` 自动进入战斗，并让 Boss 在近处起手。
- 参数可组合，例如 `?auto=1&god=1`。

## 已验证

在 1440×900、Chrome headless（本机 Google Chrome）下：

- `pnpm build` 通过。
- 标题 → 战斗 → 胜利 / 失败 → 再战闭环可走通。
- 轻击三段、重击、闪避、弹反、定身、饮酒、锁定、暂停/重开均通过脚本验证。
- Boss 重砸 / 横扫 / 冲锋三种攻击都进入过实际攻击帧；半血二阶段、削韧硬直、Boss 死亡、玩家死亡都走通。
- 命中顿帧（轻击约 70ms、重击约 82ms）、创伤平方镜头震动与 FOV 冲击在运行时触发。
- `?auto=1&god=1` 下 Boss 血量下降；控制台无 `console.error` / `pageerror`。
- 1440×900、DPR 1、`?auto=1&god=1` 实测约 60fps，3 秒采样无 >35ms 帧间隔尖峰。
- AudioContext 在点击开始后为 `running`。

截图（`artifacts/`）：

- `title.png`：书法标题页
- `gameplay.png`：实际战斗中的重击命中帧
- `result.png`：胜利结算
- `result-loss.png`：失败结算

## 结构

- `src/world.js`：山门竞技场（鸟居、石灯笼、断柱、旗帜、InstancedMesh 草、叶子/雪、远山、雾、水面 Reflector、灯光）。
- `src/player.js`：主角 GLB、5 段动画、金箍棒、连段/闪避/弹反/喝药/法术状态机。
- `src/boss.js`：石甲妖王静态 GLB 的程序化躯体演出、三招 AI、预警、二阶段、削韧和死亡。
- `src/vfx.js`：挥棍轨迹 ribbon（世界空间贴轨迹 + 36 段裂纹式弧光）、火花/尘土粒子、预警圈/扇、定身法阵、冲击环、裂纹。
- `src/game.js`：相机、输入缓冲、顿帧、镜头震动、FOV、HUD、结算、调试钩子。
- `src/post.js`：RenderPass → Bloom → OutputPass → 调色/暗角/颗粒 ShaderPass。
- `src/audio.js`：WebAudio 风声、低频氛围、挥砍、命中、弹反、妖王咆哮、脚步、钟声。

## 资产说明

试玩所需的行者与妖王 GLB 位于 `public/assets/yaowang/`，随本仓库提供。它们由本项目的概念图经 Lux3D 生成；行者还经过绑骨与动作重定向。素材与动画的进一步使用请先核实相应授权。

## 已知限制

- Boss 只有一张静态 GLB，没有骨骼动画；招式靠整体位移、倾斜、跳跃和 VFX 表达，镜头切近时能看到单体网格的僵硬。
- 玩家使用 5 段现成 Mixamo 动画，三段轻击共用同一段挥砍并改播放速度；金箍棒是后挂到右手骨骼上的程序化模型，握持角度是近似值。
- 碰撞是圆形 + 场地半径夹紧，没有复杂地形寻路；Boss 只在这一个圆形场地里活动。
- 水面使用 Reflector；远处水面主要被高草遮挡，近处水洼是屏幕空间感较强的着色器，不是物理反射。
- 首次点击后才创建/恢复 AudioContext；`?auto=1` 在无用户手势时浏览器可能让音频保持 suspended。
- 移动端没有触屏虚拟摇杆；本次以桌面 Chrome 为准。
- 为了规避 headless Metal 下 HalfFloat + MSAA 的矩形黑块伪影，composer 的 render target 关闭了 MSAA；桌面 Retina 的 DPR 上限 2 负责主要边缘质量。
- 只在 headless Chrome 与本机 1440×900 做了实际截图与帧率采样，未做低端机/移动端性能测试。
