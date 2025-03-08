module.exports = function printBanner(chalk, printMessage) {  
  const banner = ` 
  ${chalk.yellow('╔════════════════════════════════════════╗')} 
  ${chalk.yellow('║      🚀  Hanafuda Automation Tool 🚀   ║')} 
  ${chalk.yellow('║  👤    Script Author: @qklxsqf         ║')} 
  ${chalk.yellow('║  📢  Telegram Channel: https://t.me/KatayanAirdropGofC  ║')} 
  ${chalk.yellow('╚════════════════════════════════════════╝')}
  ${chalk.reset('')}   
  `;   
  
  console.log(banner);   
  printMessage('Please make sure tokens.json and pvkey.txt are ready!', 'info'); 
};
