# 野生菌采集鉴定图谱（gbfungiguide）

面向蘑菇野外调查爱好者与地方菌物名录整理者，把「采集点 → 形态描述 → 孢子印 → 菌褶/菌管着生方式 → 鉴定结论」整理成可对照的图谱条目，解决形态特征记不全、描述口径不一、鉴定结论缺乏依据留痕的问题。**纯前端单页应用**，数据全部保存在浏览器 IndexedDB，不依赖任何后端服务或外部接口。

> 免责声明：本工具仅用于采集记录与形态整理，**内容不可作为食用依据**；鉴定须与权威图鉴和专业人员复核。

## 一、Docker 一键启动（推荐）

```bash
cp .env.example .env      # 首次启动先复制环境变量文件
docker compose up -d --build
```

启动后访问：<http://localhost:21816>

```bash
docker compose ps        # 查看容器状态
docker compose logs -f   # 查看日志
docker compose down      # 停止并移除容器（数据在浏览器本地）
```

`.env` 可调：

```
COMPOSE_PROJECT_NAME=gbfungiguide
FRONTEND_PORT=21816
```

## 二、技术栈

| 层次 | 选型 |
| --- | --- |
| 框架 | Vue 3（Composition API） |
| 语言 | TypeScript（`vue-tsc` 类型检查零错误） |
| UI 组件库 | Element Plus |
| 状态管理 | Zustand（`zustand/vanilla` createStore + Vue 响应式桥接） |
| 路由 | Vue Router 4（History 模式，nginx `try_files` 回落） |
| 构建 | Vite 6 |
| 本地存储 | IndexedDB（Dexie 封装，含 `schemaVersion` 与升级迁移） |
| 并发模型 | 采集侧 / 复核侧分边各管各的（ownerSide 归属 + 本侧写入隔离） |
| 部署 | 多阶段 Dockerfile：`node:20-alpine` 构建 → `nginx:alpine` 托管 |

## 三、本地开发

```bash
cd frontend
npm install
npm run dev        # http://localhost:21816
npm run build      # 类型检查 + 生产构建
```

## 四、目录结构

```
sologsb-1116/
├── docker-compose.yml          # 顶层 name: gbfungiguide，无 version 字段
├── .env.example                # COMPOSE_PROJECT_NAME / FRONTEND_PORT
├── frontend/
│   ├── Dockerfile              # 多阶段构建，nginx 阶段 chmod -R a+rX 静态资源
│   ├── nginx.conf              # try_files 前端路由回落 + gzip
│   ├── public/favicon.svg
│   └── src/
│       ├── types/              # record.ts / spore.ts / point.ts / identify.ts / side.ts / index.ts
│       ├── stores/             # appStore / recordStore / sporeStore / pointStore / identifyStore（Zustand）
│       ├── components/common/  # SporePrintSwatch / TraitsSummary / GillAttachmentTag / GeoPointForm / MorphologyDialog
│       ├── hooks/              # usePersistentStore / useCandidateMatch
│       ├── pages/              # AtlasPage / RecordDetailPage / PointsPage / IdentifyPage / ComparePage
│       ├── router/index.ts
│       └── utils/              # spore.ts / side.ts（分边/签名/重试） / export.ts / id.ts
```

## 五、数据模型与存储

| 模型 | 说明 | Dexie 表 |
| --- | --- | --- |
| FungusRecord 菌物条目 | 采集编号、暂定名、菌盖（直径/形状/边缘/质地）、菌肉厚度与变色反应、着生方式、菌褶密度、菌柄、菌环菌托、气味、关联树种 | `records` |
| SporePrint 孢子印 | 印色、印形、获取时长、观察日期、样本干湿度 | `spores` |
| CollectPoint 采集点 | 地点名、经纬度、海拔、植被类型、基物、伴生树种、日期、采集人 | `points` |
| IdentifyLog 鉴定结论（复核侧） | 结论学名、依据、参考图鉴与页码、置信度、是否待复核、复核人、形态/孢子印依据快照 | `identifies` |

- 数据库名 `gbfungiguide`，`meta` 表保存 `schemaVersion`；
- `version(2)` 升级迁移会为历史条目补齐「菌肉变色反应」默认值（不变色）；
- `version(3)` 采集 / 复核分边：为四类数据回填 `ownerSide`，并为历史鉴定留痕按当时形态 / 孢子印补依据快照（基线即当前，回填不产生失效）；
- 数据仅存于浏览器本地，容器无状态、不挂载命名卷。

## 五·补、采集 / 复核分边规则

条目不再由采集人与复核人共用一份可互相覆盖的记录，两侧各管各的、改动只落本侧：

| 侧 | 归属（`ownerSide`） | 可写数据 |
| --- | --- | --- |
| 采集侧 `collect` | 采集人 | 形态特征（`records` 形态字段）、孢子印观察（`spores`） |
| 复核侧 `review` | 复核人 | 结论、依据、置信度、复核状态（`identifies`） |

- **互不覆盖**：写入带归属校验（`assertSide`），跨侧改动抛 `SideMismatchError`；采集人补形态不会盖掉结论，复核也不会冲掉形态。
- **结论按依据认范围**：落结论时留存依据签名（`morphSnapshot` / `sporeSnapshot`）。
  - 依据「形态特征」：形态签名变了，结论挂「需重新确认」；
  - 依据「孢子印」：只看孢子印签名变没变，形态改动不影响它；
  - 依据「显微观察」：两边都不动，永不失效。
- **重新确认**：复核人重认时结论本体不变，在复核侧**追加**一条带新快照的留痕（原留痕保留）。
- **待裁定队列**：鉴定工作页把「待复核 / 需重新确认」的条目按采集编号列出，等复核人裁定。
- **本侧重试**：采集侧保存（`withCollectRetry`）失败自动指数退避重试，耗尽后保留表单草稿供手动重试，全程不触碰复核侧。
- **首次打开先回填再启用**：启动时先跑归属回填（Dexie v3 升级事务 + 运行时幂等双保险），完成后界面才挂载；回填期间显示启动门，失败可重试。

## 六、主要页面

| 路由 | 功能 |
| --- | --- |
| `/atlas` | 图谱总览：网格卡片展示菌盖形态要点、孢子印色块与鉴定状态，按印色/着生方式筛选并新建条目 |
| `/atlas/:id` | 条目详情：上半页采集侧（形态修订、孢子印登记、采集点），下半页复核侧（当前结论状态、重新确认、留痕） |
| `/points` | 采集点管理：经纬度格式校验、条目数与主要基物统计、删除前校验下级条目 |
| `/identify` | 鉴定工作页：勾选特征给出候选排序、复核侧落结论，顶部「待裁定队列」按采集编号列出待复核/需重认条目 |
| `/compare` | 条目对比：并排最多 3 条，逐项对照菌盖/菌褶菌管/孢子印差异并高亮 |

## 七、候选排序规则

- 权重：着生方式 26、孢子印 22、菌盖形状 12、表面质地 10、菌褶密度 10、菌盖边缘 8、菌肉反应 8、关联树种 4；
- 印色与条目着生方式若属于该印色的先验组合（如白色↔离生/弯生），计半分；
- 排序先比总分，总分相同则优先展示着生方式一致的条目。
