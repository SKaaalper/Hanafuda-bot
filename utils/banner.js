
module.exports = function printBanner(chalk, printMessage) {
  const banner = `
${chalk.yellow('╔════════════════════════════════════════╗')}
${chalk.yellow('║      🚀  hanafuda自动工具 🚀           ║')}
${chalk.yellow('║  👤    脚本编写：@qklxsqf              ║')}
${chalk.yellow('║  📢  电报频道：https://t.me/ksqxszq    ║')}
${chalk.yellow('╚════════════════════════════════════════╝')}${chalk.reset('')}
  `;
  console.log(banner);
  printMessage('请确保 tokens.json 和 pvkey.txt 已准备好！', 'info');
};
