module.exports = {
  TOKEN_FILE: './tokens.json', // Path to the tokens file
  PRIVATE_KEY_FILE: './pvkey.txt', // Path to the private key file
  REQUEST_URL: 'https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql', // API request URL
  REFRESH_URL: 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY', // Token refresh URL
  RPC_URL: 'https://mainnet.base.org', // RPC endpoint for the Base mainnet
  CONTRACT_ADDRESS: '0xC5bf05cD32a14BFfb705Fb37a9d218895187376c', // Smart contract address
  FEE_THRESHOLD: 0.00000060, // ETH transaction fee threshold
  WITH_ALL: false, // Whether to use all available funds
  DRAW_LIMIT: 10, // Maximum number of draws
  LOOP_DELAY: 5, // Delay between loops (in minutes)
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', // User-Agent string for HTTP requests
  ABI: [
    {
      "constant": false,
      "inputs": [],
      "name": "depositETH",
      "outputs": [],
      "payable": true,
      "stateMutability": "payable",
      "type": "function"
    }
  ], // Smart contract ABI definition
};
