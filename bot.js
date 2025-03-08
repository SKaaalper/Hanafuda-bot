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
        // If it is a single account object, wrap it in an array
        accounts = [rawData];
      } else {
        // Otherwise, assume it is an object using refreshToken as keys
        accounts = Object.values(rawData);
      }
      printMessage(`Successfully loaded ${accounts.length} accounts`, 'success');
    } catch (error) {
      printMessage(`Failed to load ${TOKEN_FILE}: ${error.message}`, 'error');
    }
  } else {
    printMessage(`${TOKEN_FILE} does not exist, growth and draw functions will be unavailable`, 'error');
  }
}

// Modified saveTokens function: Saves as a single object when only one account exists
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

function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        .split('\n')
        .map(key => key.trim())
        .filter(key => key);
      printMessage(`Successfully loaded ${privateKeys.length} private keys${privateKeys.length === 1 ? ' (single key mode)' : ''}`, 'success');
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
        `${account.userName || 'Unknown user'} refresh token is invalid, might need to log in again or update token file`,
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
    console.log('Response data:', data);

    if (data.errors && data.errors.length > 0) {
      const unauthorizedError = data.errors.find(err => 
        err.message.includes("Unauthorized") || err.message.includes("auth/id-token-expired")
      );
      if (unauthorizedError) {
        printMessage(`${account.userName || 'Unknown user'} token unauthorized or expired, refreshing`, 'info');
        account.authToken = await refreshToken(account);
        return await getUserName(account);
      }
      printMessage('Failed to retrieve user info, currentUser is null in response', 'error');
      throw new Error('currentUser is null');
    }

    if (data && data.data && data.data.currentUser) {
      account.userName = data.data.currentUser.name;
      printMessage(`User name retrieved: ${account.userName}`, 'success');
      return account.userName;
    } else {
      printMessage('Failed to retrieve user info, currentUser is null in response', 'error');
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
