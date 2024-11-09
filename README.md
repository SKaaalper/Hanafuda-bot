# 自动成长和开启花园奖励箱


## 描述
- 在此注册：https://hanafuda.hana.network/dashboard
- 使用 Google 注册
- 提交代码：MR8SVT

- 存入 1 美元到 ETH BASE，金额无需太多。
- 完成 5,000 笔交易，每小时赚取 300 点（用于解锁卡片和获取积分）。
- 完成 10,000 笔交易以获得 643 个花园奖励箱（用于解锁收藏卡片）。

**如果已经解锁所有收藏卡片，结束脚本**

## 安装步骤
```bash
git clone https://github.com/ziqing888/Hanafuda-bot
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

