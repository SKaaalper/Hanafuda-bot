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

// Initialize Web3 and contract
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
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  if (type === 'success') console.log(chalk.green.bold(`[${timestamp}] ✔️  ${message}`));
  else if (type === 'error') console.log(chalk.red.bold(`[${timestamp}] ❌  ${message}`));
  else console.log(chalk.cyan(`[${timestamp}] ℹ️  ${message}`));
}

function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const rawData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (Array.isArray(rawData)) {
        accounts = rawData;
      } else if (rawData && rawData.authToken && rawData.refreshToken) {
        accounts = [rawData];
      } else {
        accounts = Object.values(rawData);
      }
      printMessage(`Successfully loaded ${accounts.length} accounts`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${TOKEN_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} not found, growth and draw card functions will be unavailable`, 'error');
  }
}

function saveTokens() {
  if (accounts.length === 1) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(accounts[0], null, 2));
  } else {
    const tokensData = {};
    accounts.forEach(account => (tokensData[account.refreshToken] = account));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokensData, null, 2));
  }
  printMessage('Account information saved', 'success');
}

async function refreshToken(account) {
  try {
    const response = await axios.post(REFRESH_URL, null, {
      params: { grant_type: 'refresh_token', refresh_token: account.refreshToken },
    });
    account.authToken = `Bearer ${response.data.access_token}`;
    account.refreshToken = response.data.refresh_token || account.refreshToken;
    saveTokens();
    printMessage(`${account.userName || 'Unknown User'} token refreshed successfully`, 'success');
    return account.authToken;
  } catch (error) {
    printMessage(`${account.userName || 'Unknown User'} token refresh failed: ${error.message}`, 'error');
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
    if (data && data.data && data.data.currentUser) {
      account.userName = data.data.currentUser.name;
      printMessage(`Retrieved username: ${account.userName}`, 'success');
      return account.userName;
    } else {
      printMessage('Failed to retrieve user information', 'error');
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

async function processAccount(account) {
  await getUserName(account);
  printMessage(`${account.userName} task completed`, 'success');
}

async function runLoopMode() {
  while (true) {
    printMessage('Starting a new task cycle...', 'info');
    await Promise.all(accounts.map(account => processAccount(account)));
    printMessage(`Task cycle complete, waiting ${LOOP_DELAY} minutes...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 60000 * LOOP_DELAY));
  }
}

async function askUserChoice() {
  printBanner(chalk, printMessage);
  loadTokens();
  const choice = await questionAsync('Choose run mode (enter number):\n1. Growth and Draw Card (Loop)\n> ');
  switch (choice) {
    case '1':
      if (accounts.length === 0) {
        printMessage('No accounts found, cannot execute growth and draw card', 'error');
        rl.close();
        return;
      }
      rl.close();
      await runLoopMode();
      break;
    default:
      printMessage('Invalid option, please enter 1', 'error');
      rl.close();
  }
}

askUserChoice().catch(error => {
  printMessage(`Program error: ${error.message}`, 'error');
  rl.close();
});
