const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const readline = require('readline');
const Web3 = require('web3');
const util = require('util'); 

// 配置常量
const TOKEN_FILE = './tokens.json';
const PRIVATE_KEY_FILE = './pvkey.txt';
const REQUEST_URL = 'https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql';
const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY';
const RPC_URL = 'https://mainnet.base.org';
const CONTRACT_ADDRESS = '0xC5bf05cD32a14BFfb705Fb37a9d218895187376c';
const FEE_THRESHOLD = 0.00000060;
const WITH_ALL = false;
const DRAW_LIMIT = 10;
const LOOP_DELAY = 5;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// 初始化 Web3 和合约
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const ABI = [{ "constant": false, "inputs": [], "name": "depositETH", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }];
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

// 初始化 readline 并 promisify question 方法
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const questionAsync = util.promisify(rl.question).bind(rl);

// 全局变量
let accounts = [];
let privateKeys = [];

// 日志输出函数
function printMessage(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  if (type === 'success') console.log(chalk.green.bold(`[${timestamp}] ✔️  ${message}`));
  else if (type === 'error') console.log(chalk.red.bold(`[${timestamp}] ❌  ${message}`));
  else console.log(chalk.cyan(`[${timestamp}] ℹ️  ${message}`));
}

// 美观的横幅
function printBanner() {
  const banner = `
  ==================================================
  |                                                |
  |       欢迎使用 Hanafuda 多功能自动化助手       |
  |       1. 自动存款 ETH (支持单个或多个私钥)    |
  |       2. 自动增长 (Grow Action)               |
  |       3. 自动抽卡 (Draw Cards)                |
  |                                               |
  |                                                |
  ==================================================
  `;
  console.log(chalk.cyan.bold(banner));
  printMessage('请确保 tokensgrow.json 和 pvkey.txt 已准备好（pvkey.txt 可只含一个私钥）！', 'info');
}

// 加载账户信息
function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      accounts = Object.values(JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')));
      printMessage(`成功加载 ${accounts.length} 个账户`, 'success');
    } catch (error) {
      printMessage(`加载 ${TOKEN_FILE} 失败：${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} 不存在，增长和抽卡功能将不可用`, 'error');
  }
}

// 保存账户信息
function saveTokens() {
  const tokensData = {};
  accounts.forEach(account => (tokensData[account.refreshToken] = account));
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokensData, null, 2));
  printMessage('账户信息已保存', 'success');
}

// 加载私钥
function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8').split('\n').map(key => key.trim()).filter(key => key);
      printMessage(`成功加载 ${privateKeys.length} 个私钥${privateKeys.length === 1 ? '（单个私钥模式）' : ''}`, 'success');
    } catch (error) {
      printMessage(`加载 ${PRIVATE_KEY_FILE} 失败：${error.message}`, 'error');
    }
  } else {
    printMessage(`${PRIVATE_KEY_FILE} 不存在，存款功能将不可用`, 'error');
  }
}

// 刷新 token
async function refreshToken(account) {
  try {
    const response = await axios.post(REFRESH_URL, null, {
      params: { grant_type: 'refresh_token', refresh_token: account.refreshToken },
    });
    account.authToken = `Bearer ${response.data.access_token}`;
    account.refreshToken = response.data.refresh_token || account.refreshToken;
    saveTokens();
    printMessage(`${account.userName || '未知用户'} token 刷新成功`, 'success');
    return account.authToken;
  } catch (error) {
    printMessage(`${account.userName || '未知用户'} token 刷新失败：${error.message}`, 'error');
    throw error;
  }
}

// GraphQL 请求封装
async function postRequest(payload, token) {
  try {
    const response = await axios.post(REQUEST_URL, payload, {
      headers: { 'Content-Type': 'application/json', 'Authorization': token, 'User-Agent': USER_AGENT },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
}

// 获取用户名
async function getUserName(account) {
  const payload = { operationName: 'CurrentUser', query: `query CurrentUser { currentUser { id name } }` };
  try {
    const data = await postRequest(payload, account.authToken);
    account.userName = data.data.currentUser.name;
    printMessage(`获取用户名为：${account.userName}`, 'success');
    return account.userName;
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      return await getUserName(account);
    }
    throw error;
  }
}

// 等待低交易费
async function waitForLowerFee(gasLimit) {
  let gasPrice, feeInEther;
  do {
    gasPrice = await web3.eth.getGasPrice();
    feeInEther = web3.utils.fromWei((gasPrice * gasLimit).toString(), 'ether');
    if (parseFloat(feeInEther) > FEE_THRESHOLD) {
      printMessage(`当前交易费 ${feeInEther} ETH 过高，等待中...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } while (parseFloat(feeInEther) > FEE_THRESHOLD);
  printMessage(`交易费降低至 ${feeInEther} ETH，可以执行`, 'success');
  return gasPrice;
}

// 同步交易到后端
async function syncTransaction(txHash, authToken) {
  const payload = {
    query: `mutation SyncEthereumTx($chainId: Int!, $txHash: String!) { syncEthereumTx(chainId: $chainId, txHash: $txHash) }`,
    variables: { chainId: 8453, txHash },
    operationName: 'SyncEthereumTx',
  };
  for (let i = 0; i < 4; i++) {
    try {
      const response = await postRequest(payload, authToken);
      if (response.data.syncEthereumTx) {
        printMessage(`交易 ${txHash} 已同步到后端`, 'success');
        return;
      }
      throw new Error('同步失败');
    } catch (error) {
      if (i === 2 && accounts.length > 0) authToken = await refreshToken(accounts[0]);
      if (i < 3) await new Promise(resolve => setTimeout(resolve, 5000));
      else printMessage(`交易 ${txHash} 同步失败：${error.message}`, 'error');
    }
  }
}

// 自动存款
async function depositETH(privateKey, numTx, amountInEther) {
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  web3.eth.accounts.wallet.add(account);
  const fromAddress = account.address;
  const amountInWei = web3.utils.toWei(amountInEther, 'ether');

  for (let i = 0; i < numTx; i++) {
    try {
      const balance = await web3.eth.getBalance(fromAddress);
      const gasLimit = await contract.methods.depositETH().estimateGas({ from: fromAddress, value: amountInWei });
      const gasPrice = await waitForLowerFee(gasLimit);
      const feeInEther = web3.utils.fromWei((gasPrice * gasLimit).toString(), 'ether');
      if (parseFloat(web3.utils.fromWei(balance, 'ether')) < parseFloat(amountInEther) + parseFloat(feeInEther)) {
        throw new Error('余额不足');
      }

      const tx = {
        from: fromAddress,
        to: CONTRACT_ADDRESS,
        value: amountInWei,
        gas: gasLimit,
        gasPrice,
        nonce: await web3.eth.getTransactionCount(fromAddress, 'pending'),
        data: contract.methods.depositETH().encodeABI(),
      };

      const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      printMessage(`钱包 ${fromAddress} 第 ${i + 1}/${numTx} 次存款成功，交易哈希: ${receipt.transactionHash}`, 'success');
      if (accounts.length > 0) await syncTransaction(receipt.transactionHash, accounts[0].authToken);
    } catch (error) {
      printMessage(`钱包 ${fromAddress} 第 ${i + 1} 次存款失败：${error.message}`, 'error');
      i--; // 重试
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// 执行 Grow Action
async function executeGrowAction(account) {
  const growPayload = { operationName: 'GetGardenForCurrentUser', query: `query GetGardenForCurrentUser { getGardenForCurrentUser { gardenStatus { growActionCount } } }` };
  const executePayload = {
    operationName: 'ExecuteGrowAction',
    query: `mutation ExecuteGrowAction($withAll: Boolean) { executeGrowAction(withAll: $withAll) { totalValue } }`,
    variables: { withAll: WITH_ALL },
  };

  try {
    const growData = await postRequest(growPayload, account.authToken);
    const growActionCount = growData.data.getGardenForCurrentUser.gardenStatus.growActionCount;
    printMessage(`${account.userName} 可用的 Grow Action 次数：${growActionCount}`, 'info');
    if (growActionCount === 0) return;

    if (WITH_ALL) {
      const result = await postRequest(executePayload, account.authToken);
      printMessage(`${account.userName} 一次性执行所有 Grow Action，总值：${result.data.executeGrowAction.totalValue}`, 'success');
    } else {
      for (let i = 0; i < growActionCount; i++) {
        const result = await postRequest(executePayload, account.authToken);
        printMessage(`${account.userName} 第 ${i + 1}/${growActionCount} 次 Grow Action，总值：${result.data.executeGrowAction.totalValue}`, 'success');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      await executeGrowAction(account);
    } else {
      printMessage(`${account.userName} Grow Action 失败：${error.message}`, 'error');
    }
  }
}

// 执行抽卡
async function executeDraw(account) {
  const gardenPayload = { operationName: 'GetGardenForCurrentUser', query: `query GetGardenForCurrentUser { getGardenForCurrentUser { gardenStatus { gardenRewardActionCount } } }` };
  const drawPayload = {
    operationName: 'executeGardenRewardAction',
    query: `mutation executeGardenRewardAction($limit: Int!) { executeGardenRewardAction(limit: $limit) { data { cardId group } } }`,
    variables: { limit: DRAW_LIMIT },
  };

  try {
    const gardenData = await postRequest(gardenPayload, account.authToken);
    let remainingDraws = gardenData.data.getGardenForCurrentUser.gardenStatus.gardenRewardActionCount;
    printMessage(`${account.userName} 可用的抽卡次数：${remainingDraws}`, 'info');
    if (remainingDraws === 0) return;

    while (remainingDraws > 0) {
      drawPayload.variables.limit = Math.min(DRAW_LIMIT, remainingDraws);
      const result = await postRequest(drawPayload, account.authToken);
      remainingDraws -= drawPayload.variables.limit;
      printMessage(`${account.userName} 抽了 ${drawPayload.variables.limit} 张卡，还剩 ${remainingDraws} 次`, 'success');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      await executeDraw(account);
    } else {
      printMessage(`${account.userName} 抽卡失败：${error.message}`, 'error');
    }
  }
}

// 处理单个账户（Grow + Draw）
async function processAccount(account) {
  await getUserName(account);
  await executeGrowAction(account);
  await executeDraw(account);
  printMessage(`${account.userName} 本轮任务完成`, 'success');
}

// 主循环模式（Grow + Draw）
async function runLoopMode() {
  while (true) {
    printMessage('开始新一轮任务...', 'info');
    await Promise.all(accounts.map(account => processAccount(account)));
    printMessage(`本轮任务完成，等待 ${LOOP_DELAY} 分钟...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 60000 * LOOP_DELAY));
  }
}

// 用户交互主函数（改为 async）
async function askUserChoice() {
  printBanner();
  loadTokens();
  loadPrivateKeys();

  const choice = await questionAsync('请选择运行模式 (输入数字):\n1. 自动存款 ETH\n2. 自动增长和抽卡 (循环)\n3. 两者都运行\n> ');
  switch (choice) {
    case '1':
      if (privateKeys.length === 0) {
        printMessage('未找到私钥，无法执行存款', 'error');
        rl.close();
        return;
      }
      const txCount = await questionAsync('请输入交易数量: ');
      const numTx = parseInt(txCount);
      if (isNaN(numTx) || numTx <= 0) {
        printMessage('交易数量无效', 'error');
        rl.close();
        return;
      }
      const useDefault = await questionAsync('是否使用默认金额 0.0000000000001 ETH？(y/n): ');
      let amountInEther = '0.0000000000001';
      if (useDefault.toLowerCase() !== 'y') {
        const amount = await questionAsync('请输入ETH金额: ');
        amountInEther = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? amount : amountInEther;
      }
      rl.close();
      await Promise.all(privateKeys.map(key => depositETH(key, numTx, amountInEther)));
      printMessage('存款任务完成', 'success');
      break;

    case '2':
      if (accounts.length === 0) {
        printMessage('未找到账户，无法执行增长和抽卡', 'error');
        rl.close();
        return;
      }
      rl.close();
      await runLoopMode();
      break;

    case '3':
      if (privateKeys.length === 0 || accounts.length === 0) {
        printMessage('缺少私钥或账户，无法同时运行所有功能', 'error');
        rl.close();
        return;
      }
      const txCountBoth = await questionAsync('请输入交易数量: ');
      const numTxBoth = parseInt(txCountBoth);
      if (isNaN(numTxBoth) || numTxBoth <= 0) {
        printMessage('交易数量无效', 'error');
        rl.close();
        return;
      }
      const useDefaultBoth = await questionAsync('是否使用默认金额 0.0000000000001 ETH？(y/n): ');
      let amountInEtherBoth = '0.0000000000001';
      if (useDefaultBoth.toLowerCase() !== 'y') {
        const amount = await questionAsync('请输入ETH金额: ');
        amountInEtherBoth = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? amount : amountInEtherBoth;
      }
      rl.close();
      await Promise.all(privateKeys.map(key => depositETH(key, numTxBoth, amountInEtherBoth)));
      await runLoopMode();
      break;

    default:
      printMessage('无效选项，请输入 1、2 或 3', 'error');
      rl.close();
  }
}

// 启动程序
askUserChoice().catch(error => {
  printMessage(`程序出错：${error.message}`, 'error');
  rl.close();
});
