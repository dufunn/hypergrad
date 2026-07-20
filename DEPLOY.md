# 校招决策系统上线清单

参考生产架构为：GitHub 仓库 + Vercel 静态站点 + Supabase Auth/PostgreSQL。

## 1. 创建 Supabase 项目

1. 在 Supabase 创建项目并选择离主要用户较近的区域。
2. 打开 SQL Editor，完整执行 [`supabase/schema.sql`](./supabase/schema.sql)。
3. 按时间顺序执行 [`supabase/migrations`](./supabase/migrations) 中的迁移文件。
4. 在 SQL Editor 中把管理员加入白名单：`insert into public.platform_admins (email) values ('you@example.com');`。
5. 在 Authentication → Hooks 中添加 **Before User Created**，选择 Postgres 函数 `public.hook_enforce_invite_signup` 并启用。这个钩子是服务端邀请码门禁，不能省略。
6. 在 Authentication → URL Configuration 中设置正式站点 URL，并把本地测试地址加入 Redirect URLs。
7. 在 Authentication → Email 中决定是否强制邮箱验证。正式环境建议开启。
8. 从 Project Settings → API 获取 Project URL 和 anon/publishable key。不要把 service role key 放进浏览器或 GitHub。
9. 为 JD Capture 设置允许来源，然后链接项目并部署函数：

   ```bash
   supabase secrets set ALLOWED_ORIGINS=https://your-domain.example,http://127.0.0.1:4175
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy job-import
   ```

   函数启用了 JWT 校验、来源限制与实例级限流，只有登录用户能调用；它不需要 service role key 或额外第三方密钥。

本地测试时：

```bash
cp supabase-config.example.js supabase-config.local.js
```

然后只填写 Project URL 与 anon/publishable key。`supabase-config.local.js` 已被 Git 忽略。

## 2. 检查地图配置

```bash
cp amap-config.example.js amap-config.local.js
```

填写高德 Web JS API Key 与安全密钥，并在高德控制台限制可用域名。真实配置文件不会进入 Git。

## 3. 创建 GitHub 仓库

仓库可保持 Private，也可以在完成下列检查后公开。提交前确认：

- `amap-config.local.js` 不在暂存区；
- `supabase-config.local.js` 不在暂存区；
- `.env`、本地好友数据和浏览器导出的 JSON 不在暂存区；
- 只有 `.example` 模板进入仓库。

## 4. 在 Vercel 部署

1. 在 Vercel 导入 GitHub 仓库。
2. Framework Preset 选择 Other；构建配置已由 `vercel.json` 提供。
3. 添加以下环境变量：
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `AMAP_KEY`
   - `AMAP_SECURITY_JS_CODE`
4. 部署后，把 Vercel 域名补充到 Supabase Redirect URLs 和高德允许域名。
5. 创建一个测试账户，验证注册邮件、登录、岗位同步、退出后数据隔离和朋友共享码。

## 5. 数据与权限说明

- 岗位和日程通过 `replace_my_dashboard` 在数据库事务中整体同步。
- 所有岗位、日程和共享管理表都启用了 Row Level Security。
- 登录用户只能读写自己的岗位数据。
- 朋友共享只通过 `read_friend_space` 返回匿名点位，不返回公司、岗位和日程详情。
- 浏览器保留按用户隔离的本地缓存；第一次登录会迁移旧版浏览器里的岗位记录。
- 新用户注册必须通过 `Before User Created` 钩子提交有效邀请码；邀请码只保存 SHA-256 摘要，完整码仅在创建时返回一次。
- `platform_admins` 表中的账号是平台管理员，可在账号入口创建/停用邀请码、查看注册账号和站内记录的高德地点搜索与路线规划调用。
- 管理台统计的是本应用主动记录的调用，不等同于高德账户的官方计费/配额数据；官方余量仍以高德开放平台控制台为准。
