import { BigNumber } from 'ethers';

export interface User {
  collateral: BigNumber;
  debt: BigNumber;
}

export interface Output {
  total: string;
  updated: number;
  decimals: number;
  users: { user: string; badDebt: string }[];
  tvl: string;
  deposits: string;
  borrows: string;
}

export interface IParser {
  main: () => Promise<any>;
  output: Output;
}
