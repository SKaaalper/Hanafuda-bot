import asyncio
import json
import time
from colorama import init, Fore, Style
from web3 import Web3
import aiohttp
import argparse
from utils.banner import banner 
init(autoreset=True)

print(Fore.CYAN + Style.BRIGHT + banner + Style.RESET_ALL)

# 设置RPC URL和合约地址
RPC_URL = "https://mainnet.base.org"
CONTRACT_ADDRESS = "0xC5bf05cD32a14BFfb705Fb37a9d218895187376c"
api_url = "https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql"
AMOUNT_ETH = 0.0000000001  # 存入的ETH数量
web3 = Web3(Web3.HTTPProvider(RPC_URL))

# 从文件读取私钥
with open("pvkey.txt", "r") as file:
    private_keys = [line.strip() for line in file if line.strip()]

# 从文件读取访问令牌
with open("token.txt", "r") as file:
    access_tokens = [line.strip() for line in file if line.strip()]

# 合约ABI
contract_abi = '''
[
    {
        "constant": false,
        "inputs": [],
        "name": "depositETH",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
    }
]
'''

# HTTP请求头
headers = {
    'Accept': '*/*',
    'Content-Type': 'application/json',
    'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
}

# HTTP请求封装函数
async def colay(session, url, method, payload_data=None):
    async with session.request(method, url, headers=headers, json=payload_data) as response:
        if response.status != 200:
            raise Exception(f'HTTP错误！状态码：{response.status}')
        return await response.json()

# 刷新访问令牌
async def refresh_access_token(session, refresh_token):
    api_key = "AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY"  
    async with session.post(
        f'https://securetoken.googleapis.com/v1/token?key={api_key}',
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data=f'grant_type=refresh_token&refresh_token={refresh_token}'
    ) as response:
        if response.status != 200:
            raise Exception("刷新访问令牌失败")
        data = await response.json()
        return data.get('access_token')

# 处理增长和花园任务
async def handle_grow_and_garden(session, refresh_token):  
    new_access_token = await refresh_access_token(session, refresh_token)
    headers['authorization'] = f'Bearer {new_access_token}'

    # 查询当前用户信息
    info_query = {
        "query": "query getCurrentUser { "
                    "currentUser { id totalPoint depositCount } "
                    "getGardenForCurrentUser { "
                    "gardenStatus { growActionCount gardenRewardActionCount } "
                    "} "
                    "}",
        "operationName": "getCurrentUser"
    }
    info = await colay(session, api_url, 'POST', info_query)
    
    # 显示用户信息
    balance = info['data']['currentUser']['totalPoint']
    deposit = info['data']['currentUser']['depositCount']
    grow = info['data']['getGardenForCurrentUser']['gardenStatus']['growActionCount']
    garden = info['data']['getGardenForCurrentUser']['gardenStatus']['gardenRewardActionCount']

    print(f"{Fore.GREEN}积分：{balance} | 存款次数：{deposit} | 剩余增长次数：{grow} | 剩余花园次数：{garden}{Style.RESET_ALL}")

    # 执行增长任务
    async def grow_action():
        action_query = {
            "query": "mutation issueGrowAction { issueGrowAction commitGrowAction }",
            "operationName": "issueGrowAction"
        }
                        
        try:
            mine = await colay(session, api_url, 'POST', action_query)            
            
            if mine and 'data' in mine and 'issueGrowAction' in mine['data']:
                reward = mine['data']['issueGrowAction']
                return reward
            else:
                print(f"{Fore.RED}错误：响应格式异常：{mine}{Style.RESET_ALL}")
                return 0  
        except Exception as e:
            return 0

    # 执行增长次数
    while grow > 0:
        grow_count = min(grow, 10)
        tasks = [grow_action() for _ in range(grow_count)]
        results = await asyncio.gather(*tasks)

        for reward in results:
            if reward != 0:
                balance += reward
                grow -= 1
                print(f"{Fore.GREEN}奖励：{reward} | 当前积分：{balance} | 剩余增长次数：{grow}{Style.RESET_ALL}")
        
    # 执行花园任务
    while garden >= 10:
        garden_action_query = {
            "query": "mutation executeGardenRewardAction($limit: Int!) { executeGardenRewardAction(limit: $limit) { data { cardId group } isNew } }",
            "variables": {"limit": 10},
            "operationName": "executeGardenRewardAction"
        }
        mine_garden = await colay(session, api_url, 'POST', garden_action_query)
        card_ids = [item['data']['cardId'] for item in mine_garden['data']['executeGardenRewardAction']]
        print(f"{Fore.GREEN}开启花园：{card_ids}{Style.RESET_ALL}")
        garden -= 10

# 处理ETH交易
async def handle_eth_transactions(session, num_transactions):
    global nonces
    amount_wei = web3.to_wei(AMOUNT_ETH, 'ether')
    contract = web3.eth.contract(address=CONTRACT_ADDRESS, abi=json.loads(contract_abi))
    nonces = {key: web3.eth.get_transaction_count(web3.eth.account.from_key(key).address) for key in private_keys}
    for i in range(num_transactions):
        for private_key in private_keys:
            
            from_address = web3.eth.account.from_key(private_key).address
            short_from_address = from_address[:4] + "..." + from_address[-4:]

            try:
                transaction = contract.functions.depositETH().build_transaction({
                    'from': from_address,
                    'value': amount_wei,
                    'gas': 100000,
                    'gasPrice': web3.eth.gas_price,
                    'nonce': nonces[private_key],
                })

                signed_txn = web3.eth.account.sign_transaction(transaction, private_key=private_key)
                tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
                print(f"{Fore.GREEN}交易 {i + 1} 已发送，从 {short_from_address}，交易哈希：{tx_hash.hex()}{Style.RESET_ALL}")

                nonces[private_key] += 1
                await asyncio.sleep(1)  

            except Exception as e:
                if 'nonce too low' in str(e):
                    print(f"{Fore.RED}Nonce过低，重新获取最新nonce...{Style.RESET_ALL}")
                    nonces[private_key] = web3.eth.get_transaction_count(from_address)
                else:
                    print(f"{Fore.RED}交易发送失败，地址：{short_from_address}，错误信息：{str(e)}{Style.RESET_ALL}")

# 主函数
async def main(mode, num_transactions=None):
    async with aiohttp.ClientSession() as session:
        if mode == '1':
            if num_transactions is None:
                num_transactions = int(input(Fore.YELLOW + "请输入要执行的交易数量：" + Style.RESET_ALL))
            await handle_eth_transactions(session, num_transactions)
        elif mode == '2':
            while True:  
                for refresh_token in access_tokens:
                    await handle_grow_and_garden(session, refresh_token)  
                print(f"{Fore.RED}所有账户已处理，等待10分钟...{Style.RESET_ALL}")
                time.sleep(600)  
        else:
            print(Fore.RED + "无效选项，请选择1或2。" + Style.RESET_ALL)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='选择操作模式。')
    parser.add_argument('-a', '--action', choices=['1', '2'], help='1: 执行交易, 2: 执行增长和花园任务')
    parser.add_argument('-tx', '--transactions', type=int, help='执行的交易数量（适用于模式1）')

    args = parser.parse_args()

    if args.action is None:
        args.action = input(Fore.YELLOW + "选择操作 (功能1停用请直接输入2 执行增长和花园任务): " + Style.RESET_ALL)
        while args.action not in ['1', '2']:
            print(Fore.RED + "无效选择，请选择1或2。" + Style.RESET_ALL)
            args.action = input(Fore.YELLOW + "选择操作 (功能1停用请直接输入2 执行增长和花园任务): " + Style.RESET_ALL)
   
    asyncio.run(main(args.action, args.transactions))
