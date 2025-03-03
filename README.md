# 自动成长和开启花园奖励箱+自动存款 


## 描述
- 在此注册：https://hanafuda.hana.network/dashboard
- 使用 Google 注册
- 提交代码：MR8SVT

- 存入 eth到 ETH BASE，金额无需太多。
- 完成 5,000 笔交易，每小时赚取 300 点（用于解锁卡片和获取积分）。
- 完成 10,000 笔交易以获得 643 个花园奖励箱（用于解锁收藏卡片）。

**如果已经解锁所有收藏卡片，结束脚本**

## 安装步骤
```bash
git clone https://github.com/ziqing888/Hanafuda-bot.git
cd Hanafuda-bot
```
安装依赖包
```bash
npm install

```
编辑 pvkey.txt 并输入私钥
```bash
nano pvkey.txt
```
编辑 tokens.json，输入认证令牌（支持单账户或多账户格式）：
```bash
nano tokens.json
```
单账户示例：
```bash
{
  "authToken": "Bearer your_initial_auth_token",
  "refreshToken": "your_initial_refresh_token"
}
```

多账户示例：
```bash
{
  "refreshToken1": { "refreshToken": "xxx", "authToken": "Bearer xxx" },
  "refreshToken2": { "refreshToken": "yyy", "authToken": "Bearer yyy" }
}
```
运行脚本
```bash
npm start
```
- 选择运行模式：
- 1: 自动存款 ETH（输入交易次数和金额）

- 2: 自动成长和抽卡（每 5 分钟循环一次）

- 3: 两者都运行（先存款，再循环成长和抽卡）
### 可选：使用 PM2 在后台运行
安装 PM2：
```bash
npm install -g pm2
```
后台运行脚本：
```bash
pm2 start bot.js --name "hana-bot"
```
管理 PM2 进程：
- 列出进程：pm2 list

- 重启进程：pm2 restart hana-bot

- 停止进程：pm2 stop hana-bot

- 查看日志：pm2 logs hana-bot


输入参数
输入您要执行的的次数。
选择是使用默认 ETH 数量还是输入自定义值。




