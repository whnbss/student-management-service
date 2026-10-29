# 教学管理工作台

物理教师专属的本地化教学管理系统（Web + Android APK 规划中）。学生数据与图片全部存本机，不上云。

## 当前进度

- ✅ **M1（已完成）**：项目骨架 + 登录鉴权 + 学生管理 + 学情日志（手动版）+ 课时包/缴费 + 每周课表与签到扣课时 + 今日工作台
- ✅ **M2（已完成）**：拍照/相册上传（前端压缩）+ AI 视觉分析流水线（结构化 JSON + 逐项确认编辑）+ 错题本（艾宾浩斯重做计划）+ 举一反三变式题 + AI 供应商配置与用量统计
- ✅ **Phase 4 公网开放（已完成）**：生产模式单端口托管（3210 端口同时提供页面与 API）+ SPA 深链接回退 + 反代真实 IP 限速 + 每周自动备份 + `scripts/start-prod.bat` 一键启动 + Cloudflare Tunnel/Tailscale 公网方案（见下文「公网部署」）
- 🧪 **物理实验室（第一批已交付）**：可拖拽交互课件引擎 + 5 个力学课件（斜面平衡 / 悬挂三力 / 力的合成与分解 / 牛二小车 / 超重失重），入口在桌面端侧栏「课件」或题库页顶部卡片，详见下文
- ⬜ M3：讲义库 + 知识库 + 题库 + 练习生成/组卷
- ⬜ M4：报告/分享 + 统计 + 备份 + UI 打磨
- ⬜ M5：APK 打包 + 扫码配对 + 真机部署

## 环境安装

1. 安装 [Node.js](https://nodejs.org/) ≥ 20（推荐 22/24 LTS）。
2. 项目根目录执行：

```bash
npm install
```

> 若 `better-sqlite3` 安装失败（原生模块），需安装 Visual Studio Build Tools（C++ 工作负载）后重试。

## 启动

双击 `start.bat`，或分两个终端执行：

```bash
npm run dev:api   # 后端 http://localhost:3210，启动时打印局域网地址
npm run dev:web   # 前端 http://localhost:5173
```

- 电脑浏览器访问 `http://localhost:5173`
- 手机访问：与电脑同一 WiFi，打开后端窗口打印的 `http://<电脑IP>:3210` 对应前端地址（开发模式下手机访问 `http://<电脑IP>:5173`）
- 手机无法访问时，以管理员 CMD 执行（start.bat 中也有提示）：

```
netsh advfirewall firewall add rule name="TeachingWorkbench" dir=in action=allow protocol=TCP localport=3210
```

### 生产模式（单端口，推荐日常使用）

双击 `scripts\start-prod.bat`：自动构建前端 → 只启动一个服务（3210 端口同时提供网页与 API），电脑和手机都访问 `http://<电脑IP>:3210`，不再需要 5173。支持 `/student`、`/labs/xxx` 等深链接直接刷新。

```bash
scripts\start-prod.bat            # 构建前端 + 启动单端口服务
scripts\start-prod.bat --tunnel   # 同时拉起 cloudflared 临时公网隧道（见「公网部署」）
```

重复执行是安全的：检测到 3210 已在监听会自动跳过启动。

## 登录

首次启动默认账号 `teacher`、密码 `admin123`，登录后在「我的」页修改。密码以 scrypt 哈希存储；连续输错 5 次锁定 10 分钟。

### 学生账号（学生工作台）

- 「我的 → 学生账号管理」为学生开通账号：用户名默认学生姓名（重名自动追加手机尾 4 位），**初始密码为手机号**，学生首次登录强制改密；支持批量开通、重置密码为手机号、停用/启用；
- 学生登录后进入 `/student` 学生工作台（底部 4 Tab）：**我的错题**（只看自己的错题，点开可看正确解法，「我已重做」提交后走与教师端同一套艾宾浩斯流转，教师端今日页通知铃 30 秒内收到提醒）/ **我的课时**（剩余课时、课时包与签到记录，≤3 次红色提醒）/ **我的报告**（老师生成的阶段报告只读）/ **我的课件**（与教师端同一套交互课件，只读）；
- 学生账号只能访问自己的数据（`/api/student/*`），访问教师接口一律 403。

### 课时结算方式（两种模式）

- **充值课时包**（默认）：录入课时包按次扣减，每次到课自动扣 1 课时；**余额耗尽时该学生的学生端账号自动停用**（登录提示「课时已用完，请联系老师续费」），续费加课时后自动恢复；剩余 ≤3 红色预警；
- **一课一结算**：学生编辑页可选并设置**单次课费用**；不扣课时、不因课时停用，每次到课签到自动按该金额记一条结算记录；学生详情「课时缴费」Tab 可按月查看应收合计并**导出月度账单 CSV**；学生端「我的课时」显示本月已上次数与应收金额。

## 配置 AI Key

「我的 → 智能服务配置」中录入任意 OpenAI 兼容供应商（默认预置阿里云百炼 DashScope：视觉 `qwen-vl-max`、文本 `qwen-plus`，只需填入 API Key 并保存）。支持多供应商/多 Key、连通性测试按钮、单价配置（用于费用估算）与月度用量统计。Key 存本机 SQLite，不写入代码。**注意：AI 分析会把作业图片传输给供应商**，设置页有明确提示。

**拍照分析优先用「视觉/多模态模型」**（如 qwen-vl-max、GLM-4V）；未填视觉模型时会自动回退到文本模型尝试——若该模型实际不支持图片输入，AI 供应商会返回明确报错。

### 公司内网/代理环境（重要）

AI 分析报 `fetch failed` 或「无法连接 AI 服务器」，通常是电脑需要代理才能访问外网：

- 到「我的 → 智能服务配置 → 网络代理地址」填入公司代理（如 `http://proxy.xxx:8080`）保存重试；也可设置 `HTTPS_PROXY` 环境变量。
- 若代理对 HTTPS 做了中间人签名（报证书校验失败），先运行 `certs\export-ca.ps1` 导出公司根证书到 `certs/corporate-ca.pem`，再用 `start.bat` 重启（脚本已自动设置 `NODE_EXTRA_CA_CERTS`）。
- 部分公司网关会直接拦截某些 AI 厂商域名（报「内容过滤拦截」），换用未被拦截的供应商即可。


## 拍作业批改流程（M2 核心）

1. 首页右下角 📷 悬浮按钮进入「拍作业」；
2. 选择学生 → 拍照（调起系统相机）或相册多选（最多 9 张，前端自动压缩长边 1600px）；
3. 点「开始智能分析」，等待进度提示；
4. 在结果页**逐项核对**智能分析初稿（判定/错因/知识点/建议均可编辑），勾选要入错题本的错题；
5. 点「确认保存」→ 学情记录入库，错题自动进错题本并按 1/3/7/15 天生成重做计划，今日工作台到期提醒。

识别不清的内容会放入「待确认」清单，不会编造；JSON 校验失败自动重试 2 次。

## 错题本

- 按学生/掌握状态筛选，到期重做置顶；点开错题可看答案/错误解法，重做完成后状态流转 未掌握 → 已重做一次 → 已掌握；
- 「举一反三」一键生成 2~3 道同知识点变式题（存入题库，M3 提供题库浏览）；
- 右上角可导出错题集 PDF（学生版/含答案版，浏览器打印为 PDF）。

## 物理实验室（交互课件）

- 入口：电脑端左侧导航「课件」；手机端从「题库」页顶部卡片进入；
- 全部课件支持鼠标 / 触屏 / 电子白板拖拽（Pointer Events），60fps，动画帧直接操作 SVG 不触发 React 渲染；
- 统一矢量配色：重力=红、支持力=蓝、摩擦力=橙、拉力=绿、电场/磁场力=紫、合力=黑粗虚线；
- 工具条：播放/暂停/单步/重置/0.25~2× 倍速；「力箭头 / 分量 / 受力点」三个显示开关；支持全屏课件模式（适合教室投影）；
- 每个课件内置 2~4 个典型情景预设，调好的参数可「＋ 存为预设」（存本机 localStorage，按课件区分）；
- 「实验记录」表：拖动参数滑块（松手时）或切换情景，自动把「参数 → 实时数据」记入最近 8 组数据表，课堂读数找规律像真实实验课；
- 高频课件带「🎯 挑战」模式（先预测后揭示），配色随深色模式自动切换；
- 错题本详情里有「🧪 演示该知识点」按钮，按知识点自动匹配课件。

## 家长报告与只读分享

- 入口：学生详情页「生成阶段报告」→ 选时段 → AI 生成 Glow/Grow/Plan 三段式草稿，全部可编辑后终审；
- 可导出 PDF，或点「生成分享链接」得到一个随机 token 的只读 H5 页面（可选 24 小时/3 天/7 天/30 天有效），复制发给家长，到期自动失效；
- 分享链接携带随机 token，未配置公网时只能在同一局域网内打开（数据不上云）；按「公网部署」配置 Cloudflare Tunnel 或 Tailscale 后，家长可通过公网域名或组网地址打开；
- 家长打开后可自行「保存 PDF」。

## 公网部署（Phase 4）

局域网外（家长/外出时）访问的三种方案，按需选择：

### 方案 A：Cloudflare Tunnel（推荐：免费、无需公网 IP、无需动路由器）

```bash
# 1. 安装 cloudflared
winget install --id Cloudflare.cloudflared

# 2. 先试水（无需账号）：拿到一个临时随机域名，电脑关机即失效
cloudflared tunnel --url http://localhost:3210

# 3. 固定域名（需要有一个托管在 Cloudflare 的域名）
cloudflared tunnel login                                # 浏览器授权，选择域名
cloudflared tunnel create teaching-workbench            # 创建隧道，记下输出中的隧道 UUID
cloudflared tunnel route dns teaching-workbench phys.example.com   # 把子域名指向隧道

# 4. 在 %USERPROFILE%\.cloudflared\config.yml 写入：
#    tunnel: <隧道UUID>
#    credentials-file: C:\Users\<你>\.cloudflared\<隧道UUID>.json
#    ingress:
#      - hostname: phys.example.com
#        service: http://localhost:3210
#      - service: http_status:404

# 5. 安装为系统服务（开机自启，重启电脑后公网仍然可用）
cloudflared service install
```

也可用 `scripts\start-prod.bat --tunnel` 一键「构建 + 启动 + 临时隧道」。

**公司内网/受限网络说明**：cloudflared 自身不支持 HTTP 代理，直连 Cloudflare edge（7844 端口）在公司内网会被防火墙拦截。`--tunnel` 现在走的是 `scripts/tunnel.mjs`，它会自动完成：走代理注册 trycloudflare 临时隧道 → 检测直连不通时启用「本地中继（127.0.0.1:7844 → 代理 CONNECT → Cloudflare edge）+ hosts 重定向」（写 hosts 需管理员权限，脚本会提示）→ 打印公网 URL。脚本退出（Ctrl+C）时会自动还原 hosts。`cloudflared.exe` 若未安装会经公司代理 SSO 自动下载到 `%USERPROFILE%\.local\bin\`。

### 方案 B：Tailscale（私有组网，最小暴露面）

1. 电脑与手机分别安装 [Tailscale](https://tailscale.com/) 并登录同一账号；
2. 手机浏览器访问电脑的 Tailscale 地址（形如 `http://100.x.y.z:3210`）；
3. 学生/家长装客户端登录后即可访问，无需公网入口，天然只对授权设备开放。

### 公网安全三件事

1. **改强密码**：默认 `admin123` 必须在「我的」页改掉；学生初始密码为其手机号、首次登录强制改密；
2. **域名不外传**：只发给需要的人；如需更严格，可在 Cloudflare Zero Trust（免费版）加 Cloudflare Access 按邮箱限制访问者；
3. **定期备份**：见下文「数据与备份」，`data/backups/` 每周自动生成，建议定期拷一份到移动硬盘/网盘。

登录限速已适配公网：优先按 Cloudflare 的 `CF-Connecting-IP`、其次 `X-Forwarded-For` 取真实访客 IP，不会因为所有访客共用隧道/代理 IP 而「一人锁全站」。

## 数据与备份

- 数据库：`data/app.db`（SQLite）；图片：`data/uploads/{学生ID}/{日期}/`
- **每周自动备份**：服务运行期间每 6 小时检查一次，距上次备份满 7 天自动备份到 `data/backups/backup-<时间戳>.zip`（内含数据库一致性快照 `app-*.db` + `uploads/` 全量；uploads 超过 500MB 时仅备份数据库），自动轮转保留最近 8 份。`data/` 整体已在 .gitignore 内，备份绝不会进入 git
- 手动备份：停止服务后直接复制整个 `data/` 目录
- 恢复：解压备份 zip，把其中的 `app-*.db` 重命名为 `app.db`、`uploads/` 覆盖到 `data/`，重启服务即可
- 「我的」页手动备份按钮与 WebDAV 自动备份规划中（M4）

## 技术栈

React 18 + Vite + TypeScript（严格模式）+ TailwindCSS + Zustand / Fastify + better-sqlite3 / monorepo（apps/web、apps/api、packages/shared）
