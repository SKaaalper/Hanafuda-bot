const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const readline = require('readline');
const { Web3 } = require('web3');
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

let web3;
let contract;
try {
  web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
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
      accounts = Array.isArray(rawData) ? rawData : Object.values(rawData);
      printMessage(`Loaded ${accounts.length} accounts`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${TOKEN_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} not found`, 'error');
  }
}

function saveTokens() {
  const tokensData = accounts.length === 1 ? accounts[0] : Object.fromEntries(accounts.map(a => [a.refreshToken, a]));
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokensData, null, 2));
  printMessage('Account information saved', 'success');
}

function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        .split('\n')
        .map(key => key.trim())
        .filter(Boolean);
      printMessage(`Loaded ${privateKeys.length} private keys`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${PRIVATE_KEY_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${PRIVATE_KEY_FILE} not found`, 'error');
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
    printMessage(`${account.userName || 'Unknown user'} token refreshed`, 'success');
    return account.authToken;
  } catch (error) {
    printMessage(`Token refresh failed: ${error.message}`, 'error');
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
    console.error(`HTTP Request Failed: ${error.response?.data || error.message}`);
    throw error;
  }
}

async function getUserName(account) {
  const payload = { operationName: 'CurrentUser', query: `query { currentUser { id name } }` };
  try {
    const data = await postRequest(payload, account.authToken);
    if (data?.data?.currentUser) {
      account.userName = data.data.currentUser.name;
      printMessage(`User: ${account.userName}`, 'success');
      return account.userName;
    }
    throw new Error('currentUser is null');
  } catch (error) {
    if (error.response?.status === 401) {
      account.authToken = await refreshToken(account);
      return await getUserName(account);
    }
    throw error;
  }
}

loadTokens();
loadPrivateKeys();
