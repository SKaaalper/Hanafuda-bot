const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const readline = require('readline');
const Web3 = require('web3');
const util = require('util');
const { 
  TOKEN_FILE, 
  PRIVATE_KEY_FILE, 
  REQUEST_URL, 
  REFRESH_URL, 
  RPC_URL, 
  CONTRACT_ADDRESS, 
  FEE_THRESHOLD, 
  WITH_ALL, 
  DRAW_LIMIT, 
  LOOP_DELAY, 
  USER_AGENT, 
  ABI 
} = require('./utils/config');
const printBanner = require('./utils/banner');

// 初始化 Web3 和合约
let web3;
let contract;
try {
  web3 = new Web3(RPC_URL);
  contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
} catch (error) {
  console.error('Web3 初始化失败:', error.message);
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const questionAsync = util.promisify(rl.question).bind(rl);

let accounts = [];
let privateKeys = [];

function printMessage(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  if (type === 'success') console.log(chalk.green.bold(`[${timestamp}] ✔️  ${message}`));
  else if (type === 'error') console.log(chalk.red.bold(`[${timestamp}] ❌  ${message}`));
  else console.log(chalk.cyan(`[${timestamp}] ℹ️  ${message}`));
}

// 修改后的 loadTokens 函数：支持单个账户对象格式
function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const rawData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      // 如果 rawData 是数组，则直接赋值
      if (Array.isArray(rawData)) {
        accounts = rawData;
      } else if (rawData && rawData.authToken && rawData.refreshToken) {
        // 如果是单个账户对象，则包装成数组
        accounts = [rawData];
      } else {
        // 否则认为是以 refreshToken 为 key 的对象
        accounts = Object.values(rawData);
      }
      printMessage(`成功加载 ${accounts.length} 个账户`, 'success');
    } catch (error) {
      printMessage(`加载 ${TOKEN_FILE} 失败：${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} 不存在，增长和抽卡功能将不可用`, 'error');
  }
}

// 修改后的 saveTokens 函数：当只有一个账户时直接保存为单个对象格式
function saveTokens() {
  if (accounts.length === 1) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(accounts[0], null, 2));
  } else {
    const tokensData = {};
    accounts.forEach(account => (tokensData[account.refreshToken] = account));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokensData, null, 2));
  }
  printMessage('账户信息已保存', 'success');
}

function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        .split('\n')
        .map(key => key.trim())
        .filter(key => key);
      printMessage(`成功加载 ${privateKeys.length} 个私钥${privateKeys.length === 1 ? '（单个私钥模式）' : ''}`, 'success');
    } catch (error) {
      printMessage(`加载 ${PRIVATE_KEY_FILE} 失败：${error.message}`, 'error');
    }
  } else {
    printMessage(`${PRIVATE_KEY_FILE} 不存在，存款功能将不可用`, 'error');
  }
}

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
    if (error.response && error.response.status === 400) {
      printMessage(
        `${account.userName || '未知用户'} 刷新 token 无效，可能需要重新登录或更新 token 文件`,
        'error'
      );
    } else {
      printMessage(`${account.userName || '未知用户'} token 刷新失败：${error.message}`, 'error');
    }
    throw error;
  }
}

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

async function getUserName(account) {
  const payload = { operationName: 'CurrentUser', query: `query CurrentUser { currentUser { id name } }` };
  try {
    const data = await postRequest(payload, account.authToken);
    console.log('返回数据：', data);

    if (data.errors && data.errors.length > 0) {
      const unauthorizedError = data.errors.find(err => 
        err.message.includes("Unauthorized") || err.message.includes("auth/id-token-expired")
      );
      if (unauthorizedError) {
        printMessage(`${account.userName || '未知用户'} token 未授权或已过期，正在刷新`, 'info');
        account.authToken = await refreshToken(account);
        return await getUserName(account);
      }
      printMessage('获取用户信息失败，返回数据中 currentUser 为 null', 'error');
      throw new Error('currentUser 为 null');
    }

    if (data && data.data && data.data.currentUser) {
      account.userName = data.data.currentUser.name;
      printMessage(`获取用户名为：${account.userName}`, 'success');
      return account.userName;
    } else {
      printMessage('获取用户信息失败，返回数据中 currentUser 为 null', 'error');
      throw new Error('currentUser 为 null');
    }
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      return await getUserName(account);
    }
    throw error;
  }
}

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

async function executeGrowAction(account) {
  const growPayload = { 
    operationName: 'GetGardenForCurrentUser', 
    query: `query GetGardenForCurrentUser { getGardenForCurrentUser { gardenStatus { growActionCount } } }` 
  };
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

async function executeDraw(account) {
  const gardenPayload = { 
    operationName: 'GetGardenForCurrentUser', 
    query: `query GetGardenForCurrentUser { getGardenForCurrentUser { gardenStatus { gardenRewardActionCount } } }` 
  };
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

async function processAccount(account) {
  await getUserName(account);
  await executeGrowAction(account);
  await executeDraw(account);
  printMessage(`${account.userName} 本轮任务完成`, 'success');
}

async function runLoopMode() {
  while (true) {
    printMessage('开始新一轮任务...', 'info');
    await Promise.all(accounts.map(account => processAccount(account)));
    printMessage(`本轮任务完成，等待 ${LOOP_DELAY} 分钟...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 60000 * LOOP_DELAY));
  }
}

async function askUserChoice() {
  printBanner(chalk, printMessage);
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

askUserChoice().catch(error => {
  printMessage(`程序出错：${error.message}`, 'error');
  rl.close();
});
