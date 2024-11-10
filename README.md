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
pip install -r requirements.txt

```
编辑 pvkey.txt 并输入私钥
```bash
nano pvkey.txt
```
运行脚本
```bash
python3 main.py
```
## 运行成长和开启花园奖励箱
首先，您需要获取刷新令牌

打开 HANA 仪表板：https://hanafuda.hana.network/dashboard

按 F12 打开控制台

找到 "Application"，选择 session storage

选择 hana 并复制您的 refreshToken

编辑 token.txt 并粘贴您的刷新令牌

![image](https://github.com/user-attachments/assets/fda26b50-6727-4b58-b957-5a6b92a59b90)

## 可选：使用 pm2 在后台运行脚本
可以使用 pm2 在后台运行脚本，使其在关闭终端后继续运行。

安装 pm2
如果未安装 pm2，可以通过 npm 全局安装
```bash
npm install -g pm2
```
使用 pm2  运行花园操作
```bash
pm2 start main.py --name "hana-grow" --interpreter python3 -- -a 2
```
## 管理 pm2 进程
列出正在运行的进程：
```bash
pm2 list
```
重新启动进程：
```bash
pm2 restart hana-grow
```
停止进程：
```bash

pm2 stop hana-grow
```
查看日志：
```bash
pm2 logs hana-grow
```
## 自动存款 
导航到项目目录
```bash
cd Hanafuda-bot
```
安装依赖项
执行以下命令，安装所需的软件包。
```bash
npm install web3@1.8.0 chalk@2
```
编辑tokens.json文件
```bash
{
  "authToken": "Bearer your_initial_auth_token",
  "refreshToken": "your_initial_refresh_token"
}
```
![image](https://github.com/user-attachments/assets/b98890e7-2664-4ea2-9f9f-00239714c18d)

运行机器人
使用以下命令启动机器人：
```js
node index.js
```
输入参数
输入您要执行的的次数。
选择是使用默认 ETH 数量还是输入自定义值。

如果您想支持我，请考虑请给我买杯咖啡到以下钱包：

EVM：0x30c03e3b73200b344b708350ab0cbd70fda5f849

索拉纳：AegoPL4HoBkn3gkT5VoF23t7JFTMmQvGjSUimo627777

感谢您的支持


