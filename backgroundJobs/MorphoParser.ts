import {IParser, Output, User} from "./utils/types";
import {MulticallWrapper} from "ethers-multicall-provider";
import {FallbackProvider} from "@morpho-labs/ethers-fallback-provider/lib/FallbackProvider";
import {BigNumber, constants, getDefaultProvider} from "ethers";
import {deepCopy} from "ethers/lib/utils";
import {waitForCpuToGoBelowThreshold} from "../machineResources";
import fs from "fs";
import {MorphoAaveV2, MorphoCompound} from "@morpho-labs/morpho-ethers-contract";

export interface MorphoConfiguration {
    /**
     * The deployment block of the MorphoAaveV2 contract
     */
    deploymentBlock: number,

    /**
     * The number of checks between two heavy updates
     */
    heavyUpdateInterval: number,
    /**
     * The number of blocks to make a log filter on.
     * We'll use a dichotomy on the block range to retry if we get an error
     */
    initialBlockRange: number,
    /**
     * The number of calls in a single multicall
     */
    multicallRange: number,

    /**
     * The number of multicalls to do in parallel
     */
    multicallBatchSize: number,

    /**
     * Whether to load & dump the data from/to disk or not
     */
    loadFromDisk: boolean,

}

export abstract class MorphoParser<T> implements IParser {
    protected provider = MulticallWrapper.wrap(new FallbackProvider([
        {
            provider: getDefaultProvider(process.env.ETH_NODE_URL),
            retries: 3,
            timeout: 5000,
        },
        getDefaultProvider()
    ]))
    #runs = 0;
    #configuration;
    protected lastFetchedBlock: number;

    #usersList: string[] = [];
    #users: Record<string, User<BigNumber>> = {};

    #output: Output = {
        total: "0",
        updated: 0,
        decimals: 18,
        users: [],
        tvl: "0",
        deposits: "0",
        borrows: "0",
    }
    protected utils = {
        getPath: (path: string) => `saved_data/${path}`,
        uniq: (arr: string[]) => [...new Set(arr)],
        waitSeconds: (s: number) => new Promise(resolve => setTimeout(resolve, s * 1000)),
    }

    abstract init(): Promise<void>;

    constructor(configuration: MorphoConfiguration) {
        this.#configuration = configuration;
        this.lastFetchedBlock = configuration.deploymentBlock;
    }

    get output() {
        return deepCopy(this.#output);
    }

    async main(): Promise<any> {
        try {

            await waitForCpuToGoBelowThreshold();

            const [currentBlock] = await Promise.all([
                this.provider.getBlock("latest"),
                this.init()
            ]);
            console.log(`Run on block ${currentBlock.number}`)
            if (this.#runs % this.#configuration.heavyUpdateInterval === 0) {
                await this.#heavyUpdate(currentBlock.number);
            } else {
                await this.#lightUpdate(currentBlock.number)
            }

            this.#computeBadDebt(currentBlock.timestamp);
            this.lastFetchedBlock = currentBlock.number;

            this.#runs++;
        } catch (err) {
            console.log("main failed", {err})
        }
        const waitTime = 10;
        console.log(`${this.filename.replace(".json", "")}: waiting ${waitTime} seconds before next run`);
        await this.utils.waitSeconds(waitTime);
        return this.main();
    }

    #computeBadDebt(timestamp: number) {
        const usersWithBadDebt: string[] = [];
        const {tvl, borrows, deposits, total} = Object.entries(this.#users).reduce((acc, [address, user]) => {
            const netValue = user.collateral.sub(user.debt);
            if (netValue.isNegative()) usersWithBadDebt.push(address);
            return {
                total: netValue.isNegative() ? netValue.abs().add(acc.total) : acc.total,
                tvl: acc.tvl.add(netValue),
                deposits: acc.deposits.add(user.collateral),
                borrows: acc.borrows.add(user.debt),
            }
        }, {
            total: constants.Zero,
            tvl: constants.Zero,
            deposits: constants.Zero,
            borrows: constants.Zero,
        });
        this.#output = {
            ...this.output,
            total: total.toString(),
            tvl: tvl.toString(),
            deposits: deposits.toString(),
            borrows: borrows.toString(),
            users: usersWithBadDebt.map(address => {
                const {collateral, debt} = this.#users[address];
                return {
                    user: address,
                    badDebt: collateral.sub(debt).toString()
                }
            }),
            updated: timestamp
        }
        console.log(this.#output)
    }

    async #heavyUpdate(block: number) {
        await this.#collectAllUsers(block);
        console.time("heavyUpdate");
        for (let i = 0; i < this.#usersList.length; i += this.#configuration.multicallBatchSize * this.#configuration.multicallRange) {
            const allUsers = await Promise.all(Array.from({length: this.#configuration.multicallBatchSize}).map(async (_, j) => {
                const users = this.#usersList.slice(i + j * this.#configuration.multicallRange, i + (j + 1) * this.#configuration.multicallRange);

                return this.#fetchChunkUserStatus(users, block);
            }))
            allUsers.flat().forEach(({address, user}) => {
                this.#users[address] = user;
            })
        }
        console.timeEnd("heavyUpdate");

    }

    async #fetchChunkUserStatus(users: string[], block: number) {
        console.log(`fetch ${users.length} users`);
        const userStatus = await Promise.all(users.map(async user => this.getUserBalanceStates(user, block)));

        return userStatus.map((user, index) => ({
            address: users[index],
            user: this.formatUserBalanceStates(user)
        }));
    }
    abstract getUserBalanceStates(user: string, blockTag?: number | string): Promise<T>;
    abstract formatUserBalanceStates(userBalanceStates: T): User<BigNumber>;

    async #lightUpdate(block: number) {
        if (block < this.lastFetchedBlock) {
            console.log("lightUpdate: block is lower than last fetched block");
            return;
        }
        console.time("lightUpdate");
        // We can estimate here that the blockRange is not too big, so we can fetch all the events in one go
        const userWithInteractions = await this.getUsersWithInterractions(block);

        console.timeLog("lightUpdate", `Users with interactions: ${userWithInteractions.length}`)
        this.#usersList = this.utils.uniq([...this.#usersList, ...userWithInteractions]);

        // We can estimate here that there is not too many users, so we can fetch all the users in one go with the multicall
        const users = await this.#fetchChunkUserStatus(userWithInteractions, block);
        users.forEach(({address, user}) => {
            this.#users[address] = user;
        });

        console.timeEnd("lightUpdate");
    }
    abstract getUsersWithInterractions(block: number): Promise<string[]>;

    async #collectAllUsers(currentBlock: number) {

        console.time("collectAllUsers")
        if (this.#configuration.loadFromDisk) {
            this.#loadFromDisk();
        }
        console.timeLog("collectAllUsers", `from block ${this.lastFetchedBlock} to block ${currentBlock}`)

        // run batch query filters on morpho contract
        let blockRangeSize = this.#configuration.initialBlockRange;
        let block = this.lastFetchedBlock;
        while (block < currentBlock) {
            const blockTo = Math.min(block + blockRangeSize, currentBlock);
            const users = await this.fetchUsersFromSupplyEvents(block, blockTo).catch(err => {
                console.error(`collectAllUsers: error fetching users from block ${block} to block ${blockTo}`, err);
                blockRangeSize = Math.floor(blockRangeSize / 2);
            })
            if (users) {
                this.#usersList = this.utils.uniq([...this.#usersList, ...users]);
                block = blockTo;
                blockRangeSize = this.#configuration.initialBlockRange;
            }
        }
        if (this.#configuration.loadFromDisk) {
            this.#dumpToDisk();
        }
        console.timeLog("collectAllUsers", `${this.#usersList.length} uniq users found`)
        console.timeEnd("collectAllUsers")


    }

    abstract fetchUsersFromSupplyEvents(blockFrom: number, blockTo: number): Promise<string[]>;
    #dumpToDisk() {
        if(this.#usersList.length === 0) return;
        if(!fs.existsSync(this.utils.getPath(""))) fs.mkdirSync(this.utils.getPath(""), {recursive: true})
        fs.writeFileSync(this.utils.getPath("MorphoAaveV2_users.json"), JSON.stringify({
            lastFetchedBlock: this.lastFetchedBlock,
            users: this.#usersList,
        }, null, 2), {encoding: "utf-8"})
    }

    #loadFromDisk() {
        const filename = this.utils.getPath(this.filename)
        if (!fs.existsSync(filename)) {
            console.log(`loadFromDisk: file ${filename} does not exist`);
            return;
        }
        const data = JSON.parse(fs.readFileSync(filename).toString()) as { lastFetchedBlock: number, users: string[] };
        this.lastFetchedBlock = data.lastFetchedBlock;
        this.#usersList = data.users;
    }

    abstract filename: string;

}

export abstract class MorphoParserV1<T> extends MorphoParser<T> {
    abstract morpho: MorphoAaveV2 | MorphoCompound
    getUsersWithInterractions(block: number) {
        // We can estimate here that the blockRange is not too big, so we can fetch all the events in one go
        return Promise.all([
            this.morpho.queryFilter(this.morpho.filters.Supplied(), this.lastFetchedBlock + 1, block).then(r => r.map(e => e.args._onBehalf)),
            this.morpho.queryFilter(this.morpho.filters.Withdrawn(), this.lastFetchedBlock + 1, block).then(r => r.map(e => e.args._supplier)),
            this.morpho.queryFilter(this.morpho.filters.Borrowed(), this.lastFetchedBlock + 1, block).then(r => r.map(e => e.args._borrower)),
            this.morpho.queryFilter(this.morpho.filters.Repaid(), this.lastFetchedBlock + 1, block).then(r => r.map(e => e.args._onBehalf)),
            // Liquidation emits Repaid and Withdrawn events
        ]).then((ev) => this.utils.uniq(ev.flat()));
    }

    async fetchUsersFromSupplyEvents(blockFrom: number, blockTo: number) {
        const supplyEvents = await this.morpho.queryFilter(this.morpho.filters.Supplied(), blockFrom, blockTo);
        const users = supplyEvents.map(event => event.args?._onBehalf).filter(user => user !== undefined) as string[];
        return this.utils.uniq(users);
    }


}