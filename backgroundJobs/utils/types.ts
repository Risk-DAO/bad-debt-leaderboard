import BN from "bn.js";
import {BigNumber} from "ethers";

export interface User<T extends BigNumber | BN> {
        collateral: T;
        debt: T;
    }

export interface Output {
    total: string;
    updated: number;
    decimals: number;
    users: {user: string; badDebt: string}[];
    tvl: string;
    deposits: string;
    borrows: string;
}

export interface IParser {
    main: () => Promise<any>
    output: Output
}