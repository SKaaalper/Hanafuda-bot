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

// Initialize Web3 properly
let web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
let contract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const questionAsync = (query) => new Promise((resolve) => rl.question(query, resolve));

let accounts = [];
let privateKeys = [];

function printMessage(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  if (type === 'success') console.log(chalk.green.bold(`[${timestamp}] ✅ ${message}`));
  else if (type === 'error') console.log(chalk.red.bold(`[${timestamp}] ❌ ${message}`));
  else console.log(chalk.cyan(`[${timestamp}] ℹ️  ${message}`));
}

// Load tokens
function loadTokens() {
  if (fs.existsSync(TOKEN_FILE)) {
    try {
      const rawData = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      accounts = Array.isArray(rawData) ? rawData : [rawData];
      printMessage(`Loaded ${accounts.length} accounts`, 'success');
    } catch (error) {
      printMessage(`Failed to load tokens: ${error.message}`, 'error');
    }
  }
}

// Load private keys
function loadPrivateKeys() {
  if (fs.existsSync(PRIVATE_KEY_FILE)) {
    try {
      privateKeys = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8')
        .split('\n')
        .map(key => key.trim())
        .filter(key => key);
      printMessage(`Loaded ${privateKeys.length} private keys`, 'success');
    } catch (error) {
      printMessage(`Failed to load private keys: ${error.message}`, 'error');
    }
  }
}

// Main menu function
async function askUserChoice() {
  printBanner(chalk, printMessage);
  loadTokens();
  loadPrivateKeys();

  console.log('\nSelect an option:\n1. Auto Deposit ETH\n2. Auto Grow & Draw (Loop)\n3. Run Both');
  
  const choice = await questionAsync('Enter choice (1, 2, or 3): ');

  switch (choice.trim()) {
    case '1':
      console.log('Running Auto Deposit ETH...');
      break;
    case '2':
      console.log('Running Auto Grow & Draw...');
      break;
    case '3':
      console.log('Running Both Functions...');
      break;
    default:
      printMessage('Invalid selection, exiting...', 'error');
  }

  rl.close();
}

askUserChoice().catch(error => {
  printMessage(`Error: ${error.message}`, 'error');
  rl.close();
});
