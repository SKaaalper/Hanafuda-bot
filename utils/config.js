module.exports = {
  TOKEN_FILE: './tokensgrow.json',
  PRIVATE_KEY_FILE: './pvkey.txt',
  REQUEST_URL: 'https://hanafuda-backend-app-520478841386.us-central1.run.app/graphql',
  REFRESH_URL: 'https://securetoken.googleapis.com/v1/token?key=AIzaSyDipzN0VRfTPnMGhQ5PSzO27Cxm3DohJGY',
  RPC_URL: 'https://mainnet.base.org',
  CONTRACT_ADDRESS: '0xC5bf05cD32a14BFfb705Fb37a9d218895187376c',
  FEE_THRESHOLD: 0.00000060, // ETH
  WITH_ALL: false,
  DRAW_LIMIT: 10,
  LOOP_DELAY: 5, // 分钟
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ABI: [{ "constant": false, "inputs": [], "name": "depositETH", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }],
};
