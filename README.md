## Automatic Growth and Garden Reward Box Opening + Auto Deposit

### Description
- Register here: https://hanafuda.hana.network/dashboard

- Sign up using Google

- Submit code: `G8ET54`

- Deposit ETH into ETH BASE, no need for a large amount.

- Complete 5,000 transactions to earn 300 points per hour (used for unlocking cards and earning points).

- Complete 10,000 transactions to receive 643 garden reward boxes (used for unlocking collectible cards).

- If all collectible cards have been unlocked, end the script.

### Installation Steps:

1. Clone the repo:
```
git clone https://github.com/SKaaalper/Hanafuda-bot.git
cd Hanafuda-bot
```

2. Install dependencies:
```
npm install
```

3. Edit `pvkey.txt` and enter your private key:
```
nano pvkey.txt
```

4. Edit `tokens.json` and enter authentication tokens (supports single or multiple accounts):

![image](https://github.com/user-attachments/assets/8feaa85b-0953-4bca-8caa-f265586ad7ce)


```
nano tokens.json
```
- Single account example:
```
{
  "authToken": "Bearer your_initial_auth_token",
  "refreshToken": "your_initial_refresh_token"
}
```
- Multiple Account:
```
{
  "refreshToken1": { "refreshToken": "xxx", "authToken": "Bearer xxx" },
  "refreshToken2": { "refreshToken": "yyy", "authToken": "Bearer yyy" }
}
```

5. (Optional): Run in the background using `screen`
```
screen -S hanafuda
```

6. Run the Bot:
```
npm start
```
Choose the operation mode:
- Auto deposit ETH (enter the number of transactions and amount)
- Auto growth and card drawing (loops every 5 minutes)
- Run both (deposit first, then loop growth and card drawing)
