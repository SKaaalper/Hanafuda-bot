export class Config {
  static USEDEPOSIT = true; // 开启或关闭存款
  static DEPOSITAMOUNT = 0.00001; // 存款金额
  static DAILYDEPOSITCOUNT = 10; // 每日存款次数
  static GWEIPRICE = 0.15; // GWEI价格
  static WAITFORBLOCKCONFIRMATION = true; // 如果为真，交易执行后将等待交易被挖掘，如果为假，交易执行后将继续到下一个交易
  static DISPLAY = "TWIST"; // TWIST 或 BLESS
}
