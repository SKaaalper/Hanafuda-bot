# HANAFUDA BOT
Hanafuda Bot 是一个强大的工具，专为您自动化 hanafuda 溯源空投而设计。

## 注册 HanaFuda（Hana 网络）

- https://hanafuda.hana.network
- 使用邀请码：MR8SVT
- 在 ARB 或 BASE 网络中存入 $0.5-$1 以获得低 gas 费用
- 转到仪表盘
- 通过 Grow 和 Draw Hanafuda 赚取积分
- 提现将在 2025 年第一季度开始

## 加入我的频道
这是一个专门分享机器人或空投的 Telegram 频道，点击此处加入
[**加入频道**](https://t.me/ksqxszq)。

## BOT 特性
- 多账户支持
- 支持私钥（PK）和助记词（SEED）
- 自动存款
- 自动增长
- 自动绘制花牌（如果你有 10 张花牌）

## 设置和配置 BOT


### Linux
1. 克隆项目仓库
   ```
   git clone https://github.com/airdropinsiders/Hanafuda-Testnet.git && cd Hanafuda-Testnet
   ```
2. 执行

   ```
   npm install && npm run setup
   ```
3. 配置你的账户

   ```
   nano accounts/accounts.js
   ```
4. 配置机器人的配置文件

   ```
   nano config/config.js
   ```
5. 配置代理

   ```
   nano config/proxy_list.js
   ```
6. 启动机器人

   ```
   npm run start
   ```
   

### Windows
1. 打开 `命令提示符` 或 `Power Shell`。
2. 克隆项目仓库

   ```
   git clone https://github.com/Widiskel/hanafuda-bot.git && cd hanafuda-bot
   ```
3. 执行 

   ```
   npm install && npm run setup
   ```
5. 进入 `Hanafuda-bot` 目录。
6. 进入 `accounts` 文件夹并将 `accounts_tmp.js` 重命名为 `accounts.js`。
7. 打开 `accounts.js` 并设置你的账户。
8. 返回 `Hanafuda-bot` 目录并进入 `config` 文件夹，按需要调整 `config.js` 配置。
9. 如果需要使用代理，打开 `proxy_list.js` 进行配置。
10. 返回 `Hanafuda-bot` 目录。
11. 打开 `命令提示符` 或 `PowerShell` 启动应用。
12. 启动机器人
    ```
    npm run start
    ```

## 更新 Bot

更新机器人请按以下步骤操作：
1. 执行
   ```
   git pull
   ```
   或
   ```
   git pull --rebase
   ```
   如果出现错误，执行

   ```
   git stash && git pull
   ```
2. 执行

   ```
   npm update
   ```
3. 启动机器人

## 注意事项
自行验证风险

账户信息应按以下格式书写：

```
[
      {
          refreshToken: "YOUR REFRESH TOKEN",
          pk: "YOUR PRIVATE KEY",
      },
      {
          refreshToken: "YOUR REFRESH TOKEN",
          pk: "YOUR PRIVATE KEY",
      }
]
```

## 如何获取刷新令牌？
- 打开 hanafuda 网站并退出你的账户。
- 然后打开浏览器的开发者工具 / 检查元素。
- 转到网络选项卡。
- 再次使用你的 Google 账户登录。
- 查找带有以下 URL 的 XHR/Fetch 请求 `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=`
- 点击该请求并打开响应选项卡 / 预览选项卡。
- 你将获得 `refreshToken`，将其复制到机器人的账户中。
- 确保你已经连接钱包，这样你的钱包和 Hanafuda 账户就绑定在一起。

