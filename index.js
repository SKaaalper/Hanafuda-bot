const Web3 = require('web3');
const chalk = require('chalk');
const readline = require('readline');
const fs = require('fs');
const axios = require('axios');

// 使用提供的 RPC URL 初始化 web3
const RPC_URL = "https://mainnet.base.org";
const CONTRACT_ADDRESS = "0xC5bf05cD32a14BFfb705Fb37a9d218895187376c";

// 用于存储令牌和认证数据的文件
const TOKEN_FILE = './tokens.json';

// 常量
const REQUEST_URL = 'https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql';
const REFRESH_URL = 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY';
const FEE_THRESHOLD = 0.00000060;  // 交易费阈值（以太币）

// 设置 web3 实例
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));

// depositETH 函数的 ABI
const ABI = [
  {
    "constant": false,
    "inputs": [],
    "name": "depositETH",
    "outputs": [],
    "payable": true,
    "stateMutability": "payable",
    "type": "function"
  }
];

// 合约实例
const contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

// 从控制台读取用户输入的函数
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 从 pvkey.txt 文件中读取私钥
function readPrivateKeys() {
  try {
    const filePath = __dirname + '/pvkey.txt'; // 修改为 pvkey.txt
    console.log('尝试读取私钥文件路径:', filePath);
    const data = fs.readFileSync(filePath, 'utf8');
    return data.split('\n').map(key => key.trim()).filter(key => key.length > 0);
  } catch (error) {
    console.error('读取私钥时出错:', error.message);
    process.exit(1);
  }
}

// 从 tokens.json 中读取令牌
function getTokens() {
  try {
    const data = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取令牌时出错:', error.message);
    process.exit(1);
  }
}

// 将更新后的令牌保存到 tokens.json
function saveTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    console.log(chalk.yellow('令牌已成功更新。'));
  } catch (error) {
    console.error(`保存令牌时出错: ${error.message}`);
    process.exit(1);
  }
}

// 刷新令牌的函数
async function refreshTokenHandler() {
  const tokens = getTokens();
  console.log(chalk.yellow('尝试刷新令牌...'));
  try {
    const response = await axios.post(REFRESH_URL, null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken
      }
    });

    // 使用新的访问令牌和刷新令牌更新 tokens
    tokens.authToken = `Bearer ${response.data.access_token}`;
    tokens.refreshToken = response.data.refresh_token;
    saveTokens(tokens);  // 保存更新后的令牌到文件

    console.log(chalk.green('令牌已刷新并成功保存。'));
    return tokens.authToken;
  } catch (error) {
    console.error(`刷新令牌失败: ${error.message}`);
    return false;
  }
}

// 等待交易费低于定义的阈值（单位：以太币）
async function waitForLowerFee(gasLimit) {
  let gasPrice, txnFeeInEther;
  do {
    gasPrice = await web3.eth.getGasPrice();
    const txnFee = gasPrice * gasLimit;  // 交易费（单位：Wei）
    txnFeeInEther = web3.utils.fromWei(txnFee.toString(), 'ether');  // 将交易费转换为以太币

    if (parseFloat(txnFeeInEther) > FEE_THRESHOLD) {
      console.log(`当前交易费: ${txnFeeInEther} ETH，正在等待...`);
      await new Promise(resolve => setTimeout(resolve, 5000));  // 等待5秒后再次检查
    }
  } while (parseFloat(txnFeeInEther) > FEE_THRESHOLD);

  console.log(`检测到可接受的交易费: ${txnFeeInEther} ETH`);
  return gasPrice;  // 返回可接受的 gas 价格
}

// 使用重试机制与后端同步交易
async function syncTransaction(txHash) {
  let tokens = getTokens();          // 从 tokens.json 获取令牌
  const maxRetries = 4;              // 最大重试次数
  const retryDelay = 5000;           // 重试间隔（毫秒）
  let authToken = tokens.authToken;  // 设置初始的 authToken

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(
        REQUEST_URL,
        {
          query: `
            mutation SyncEthereumTx($chainId: Int!, $txHash: String!) {
              syncEthereumTx(chainId: $chainId, txHash: $txHash)
            }`,
          variables: {
            chainId: 8453,  // 根据特定链 ID 进行调整
            txHash: txHash
          },
          operationName: "SyncEthereumTx"
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authToken  // 在请求头中包含 authToken
          }
        }
      );

      // 检查 syncEthereumTx 是否成功，同步成功则退出循环
      if (response.data && response.data.data && response.data.data.syncEthereumTx) {
        console.log(chalk.green(`交易 ${txHash} 已成功与后端同步。`));
        break;  // 同步成功则退出重试循环
      } else {
        throw new Error(`同步响应为空或未成功。`);
      }

    } catch (error) {
      console.error(`第 ${attempt} 次尝试 - 同步交易 ${txHash} 时出错:`, error.message);

      // 第三次尝试时刷新令牌
      if (attempt === 3) {
        console.log(chalk.yellow('第3次尝试时正在刷新令牌...'));
        
        const refreshedToken = await refreshTokenHandler();  // 刷新令牌
        if (refreshedToken) {
          authToken = refreshedToken;  // 更新本地 authToken
          console.log(chalk.green('令牌刷新成功。使用新令牌重试请求...'));
          attempt--;  // 减少一次尝试次数以使用刷新后的令牌重试
          continue; // 使用刷新后的令牌立即重试
        } else {
          console.error(chalk.red('令牌刷新失败，无法继续重试。'));
          break;
        }
      }

      // 如果不是最后一次尝试，等待一段时间后重试
      console.log(`将在 ${retryDelay / 1000} 秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));  // 重试前等待
    }
  }
}

// 为所有钱包执行交易
async function executeTransactionsForAllWallets(privateKeys, numTx, amountInEther) {
  for (const privateKey of privateKeys) {
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    const address = account.address;

    console.log(chalk.blue(`处理钱包的交易: ${address}`));
    await executeTransactions(privateKey, numTx, amountInEther);
  }
  console.log('所有钱包已处理。');
}

// 为单个钱包执行交易的函数
async function executeTransactions(privateKey, numTx, amountInEther) {
  try {
    const amountInWei = web3.utils.toWei(amountInEther, 'ether');
    const account = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(account);
    const fromAddress = account.address;

    for (let i = 0; i < numTx; i++) {
      try {
        const currentNonce = await web3.eth.getTransactionCount(fromAddress, 'pending');
        const gasLimit = await contract.methods.depositETH().estimateGas({ from: fromAddress, value: amountInWei });

        const gasPrice = await waitForLowerFee(gasLimit);

        const tx = {
          from: fromAddress,
          to: CONTRACT_ADDRESS,
          value: amountInWei,
          gas: gasLimit,
          gasPrice: gasPrice,
          nonce: currentNonce,
          data: contract.methods.depositETH().encodeABI()
        };

        const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`交易 ${i + 1} 成功，交易哈希: ${receipt.transactionHash}`);

        // 与后端同步交易
        await syncTransaction(receipt.transactionHash);

      } catch (txError) {
        console.error(`交易 ${i + 1} 出错:`, txError.message);
        console.log(`重试交易 ${i + 1}...`);
        i--;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log(`钱包 ${fromAddress} 的交易已完成。`);
  } catch (error) {
    console.error(`执行钱包交易时出错: ${error.message}`);
  }
}

// 显示标题
function printHeader() {
  const line = "=".repeat(50);
  const title = "自动存款 Hanafuda";
  const createdBy = "机器人创建者:https://t.me/ksqxszq ";

  const totalWidth = 50;
  const titlePadding = Math.floor((totalWidth - title.length) / 2);
  const createdByPadding = Math.floor((totalWidth - createdBy.length) / 2);

  const centeredTitle = title.padStart(titlePadding + title.length).padEnd(totalWidth);
  const centeredCreatedBy = createdBy.padStart(createdByPadding + createdBy.length).padEnd(totalWidth);

  console.log(chalk.cyan.bold(line));
  console.log(chalk.cyan.bold(centeredTitle));
  console.log(chalk.green(centeredCreatedBy));
  console.log(chalk.cyan.bold(line));
}

// 主函数
async function main() {
  try {
    const privateKeys = readPrivateKeys();

    if (privateKeys.length === 0) {
      console.log('pvkey.txt 中未找到任何私钥。退出...');
      process.exit(1);
    }

    rl.question('请输入交易数量: ', async (txCount) => {
      const numTx = parseInt(txCount);

      if (isNaN(numTx) || numTx <= 0) {
        console.log('交易数量无效。退出...');
        rl.close();
        return;
      }

      rl.question('是否使用默认金额 0.0000000000001 ETH？(y/n): ', async (useDefault) => {
        let amountInEther = '0.0000000000001';

        if (useDefault.toLowerCase() !== 'y') {
          rl.question('请输入要发送的ETH金额: ', (amount) => {
            if (!isNaN(parseFloat(amount)) && parseFloat(amount) > 0) {
              amountInEther = amount;
            } else {
              console.log('输入的金额无效。将使用默认金额。');
            }
            rl.close();
            executeTransactionsForAllWallets(privateKeys, numTx, amountInEther);
          });
        } else {
          rl.close();
          executeTransactionsForAllWallets(privateKeys, numTx, amountInEther);
        }
      });
    });
  } catch (error) {
    console.error('错误:', error);
    rl.close();
  }
}

// 运行主函数
printHeader();
main();
