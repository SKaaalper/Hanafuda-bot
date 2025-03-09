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

// Initialize Web3 and Contract
let web3;
let contract;
try {
  web3 = new Web3(RPC_URL);
  contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);
} catch (error) {
  console.error('Web3 initialization failed:', error.message);
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

// Modified loadTokens function: Supports single account object format
function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const rawData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      // If rawData is an array, assign it directly
      if (Array.isArray(rawData)) {
        accounts = rawData;
      } else if (rawData && rawData.authToken && rawData.refreshToken) {
        // If it is a single account object, wrap it into an array
        accounts = [rawData];
      } else {
        // Otherwise, assume it is an object with refreshToken as the key
        accounts = Object.values(rawData);
      }
      printMessage(`Successfully loaded ${accounts.length} accounts`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${TOKEN_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} does not exist, growth and card draw functions will be unavailable`, 'error');
  }
}

// Modified saveTokens function: Saves as a single object format when there is only one account
function saveTokens() {
  if (accounts.length === 1) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(accounts[0], null, 2));
  } else {
    const tokensData = {};
    accounts.forEach(account => (tokensData[account.refreshToken] = account));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokensData, null, 2));
  }
  printMessage('Account information has been saved', 'success');
}

function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        .split('\n')
        .map(key => key.trim())
        .filter(key => key);
      printMessage(`Successfully loaded ${privateKeys.length} private keys${privateKeys.length === 1 ? ' (Single Private Key Mode)' : ''}`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${PRIVATE_KEY_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${PRIVATE_KEY_FILE} does not exist, deposit function will be unavailable`, 'error');
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
    printMessage(`${account.userName || 'Unknown user'} token refreshed successfully`, 'success');
    return account.authToken;
  } catch (error) {
    if (error.response && error.response.status === 400) {
      printMessage(
        `${account.userName || 'Unknown user'} refresh token is invalid, you may need to log in again or update the token file`,
        'error'
      );
    } else {
      printMessage(`${account.userName || 'Unknown user'} token refresh failed: ${error.message}`, 'error');
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
    console.log('Returned data:', data);

    if (data.errors && data.errors.length > 0) {
      const unauthorizedError = data.errors.find(err => 
        err.message.includes("Unauthorized") || err.message.includes("auth/id-token-expired")
      );
      if (unauthorizedError) {
        printMessage(`${account.userName || 'Unknown user'} token is unauthorized or expired, refreshing now`, 'info');
        account.authToken = await refreshToken(account);
        return await getUserName(account);
      }
      printMessage('Failed to get user info, currentUser is null in the returned data', 'error');
      throw new Error('currentUser is null');
    }

    if (data && data.data && data.data.currentUser) {
      account.userName = data.data.currentUser.name;
      printMessage(`Retrieved username: ${account.userName}`, 'success');
      return account.userName;
    } else {
      printMessage('Failed to get user info, currentUser is null in the returned data', 'error');
      throw new Error('currentUser is null');
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
      printMessage(`Current transaction fee ${feeInEther} ETH is too high, waiting...`, 'info');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  } while (parseFloat(feeInEther) > FEE_THRESHOLD);
  printMessage(`Transaction fee has dropped to ${feeInEther} ETH, ready to execute`, 'success');
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
        printMessage(`Transaction ${txHash} has been synchronized to the backend`, 'success');
        return;
      }
      throw new Error('Synchronization failed');
    } catch (error) {
      if (i === 2 && accounts.length > 0) authToken = await refreshToken(accounts[0]);
      if (i < 3) await new Promise(resolve => setTimeout(resolve, 5000));
      else printMessage(`Transaction ${txHash} synchronization failed: ${error.message}`, 'error');
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
        throw new Error('Insufficient balance');
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
      printMessage(`Wallet ${fromAddress} deposit attempt ${i + 1}/${numTx} successful, transaction hash: ${receipt.transactionHash}`, 'success');
      if (accounts.length > 0) await syncTransaction(receipt.transactionHash, accounts[0].authToken);
    } catch (error) {
      printMessage(`Wallet ${fromAddress} deposit attempt ${i + 1} failed: ${error.message}`, 'error');
      i--; // Retry
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
    printMessage(`${account.userName} Available Grow Action count: ${growActionCount}`, 'info');
    if (growActionCount === 0) return;

    if (WITH_ALL) {
      const result = await postRequest(executePayload, account.authToken);
      printMessage(`${account.userName} Executed all Grow Actions at once, total value: ${result.data.executeGrowAction.totalValue}`, 'success');
    } else {
      for (let i = 0; i < growActionCount; i++) {
        const result = await postRequest(executePayload, account.authToken);
        printMessage(`${account.userName} Grow Action ${i + 1}/${growActionCount}, total value: ${result.data.executeGrowAction.totalValue}`, 'success');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      await executeGrowAction(account);
    } else {
      printMessage(`${account.userName} Grow Action failed: ${error.message}`, 'error');
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
    printMessage(`${account.userName} Available draw card count: ${remainingDraws}`, 'info');
    if (remainingDraws === 0) return;

    while (remainingDraws > 0) {
      drawPayload.variables.limit = Math.min(DRAW_LIMIT, remainingDraws);
      const result = await postRequest(drawPayload, account.authToken);
      remainingDraws -= drawPayload.variables.limit;
      printMessage(`${account.userName} Drew ${drawPayload.variables.limit} cards, ${remainingDraws} remaining`, 'success');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      await executeDraw(account);
    } else {
      printMessage(`${account.userName} Draw card failed: ${error.message}`, 'error');
    }
  }
}

async function processAccount(account) {
  await getUserName(account);
  await executeGrowAction(account);
  await executeDraw(account);
  printMessage(`${account.userName} This round of tasks is complete`, 'success');
}

async function runLoopMode() {
  while (true) {
    printMessage('Starting a new round of tasks...', 'info');
    await Promise.all(accounts.map(account => processAccount(account)));
    printMessage(`This round of tasks is complete, waiting ${LOOP_DELAY} minutes...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 60000 * LOOP_DELAY));
  }
}

async function askUserChoice() {
  printBanner(chalk, printMessage);
  loadTokens();
  loadPrivateKeys();

  const choice = await questionAsync('Please select the operating mode (enter a number):\n1. Automatic deposit ETH\n2. Automatic growth and card drawing (loop)\n3. Run both\n> ');
  switch (choice) {
    case '1':
      if (privateKeys.length === 0) {
        printMessage('No private key found, unable to execute deposit', 'error');
        rl.close();
        return;
      }
      const txCount = await questionAsync('Enter the number of transactions: ');
      const numTx = parseInt(txCount);
      if (isNaN(numTx) || numTx <= 0) {
        printMessage('Invalid number of transactions', 'error');
        rl.close();
        return;
      }
      const useDefault = await questionAsync('Use the default amount 0.0000000000001 ETH? (y/n): ');
      let amountInEther = '0.0000000000001';
      if (useDefault.toLowerCase() !== 'y') {
        const amount = await questionAsync('Enter ETH amount: ');
        amountInEther = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? amount : amountInEther;
      }
      rl.close();
      await Promise.all(privateKeys.map(key => depositETH(key, numTx, amountInEther)));
      printMessage('Deposit task completed', 'success');
      break;

    case '2':
      if (accounts.length === 0) {
        printMessage('No account found, unable to execute growth and card drawing', 'error');
        rl.close();
        return;
      }
      rl.close();
      await runLoopMode();
      break;

    case '3':
      if (privateKeys.length === 0 || accounts.length === 0) {
        printMessage('Missing private key or account, unable to run all functions simultaneously', 'error');
        rl.close();
        return;
      }
      const txCountBoth = await questionAsync('Enter the number of transactions: ');
      const numTxBoth = parseInt(txCountBoth);
      if (isNaN(numTxBoth) || numTxBoth <= 0) {
        printMessage('Invalid number of transactions', 'error');
        rl.close();
        return;
      }
      const useDefaultBoth = await questionAsync('Use the default amount 0.0000000000001 ETH? (y/n): ');
      let amountInEtherBoth = '0.0000000000001';
      if (useDefaultBoth.toLowerCase() !== 'y') {
        const amount = await questionAsync('Enter ETH amount: ');
        amountInEtherBoth = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 ? amount : amountInEtherBoth;
      }
      rl.close();
      await Promise.all(privateKeys.map(key => depositETH(key, numTxBoth, amountInEtherBoth)));
      await runLoopMode();
      break;

    default:
      printMessage('Invalid option, please enter 1, 2, or 3', 'error');
      rl.close();
  }
}

askUserChoice().catch(error => {
  printMessage(`Program error: ${error.message}`, 'error');
  rl.close();
});
