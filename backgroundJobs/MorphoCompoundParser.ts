import {MorphoParser, MorphoParserV1} from "./MorphoParser";

import {MorphoCompoundLens} from "@morpho-labs/morpho-ethers-contract/lib/compound/MorphoCompoundLens";
import {BigNumber, providers} from "ethers";
import {
    MorphoCompound,
    MorphoCompound__factory,
    MorphoCompoundLens__factory
} from "@morpho-labs/morpho-ethers-contract";
import addresses from "@morpho-labs/morpho-ethers-contract/lib/addresses";

interface CompoundBalanceState  {
    collateralValue: BigNumber;
    debtValue: BigNumber;
    maxDebtValue: BigNumber;
}
const configuration = {
    morphoAddress: addresses.morphoCompound.morpho,
    lensAddress: addresses.morphoCompound.lens,
    deploymentBlock: 14860866,
    /**
     * The number of checks between two heavy updates
     */
    heavyUpdateInterval: 24,
    /**
     * The number of blocks to make a log filter on.
     * We'll use a dichotomy on the block range to retry if we get an error
     */
    initialBlockRange: 100000,
    /**
     * The number of calls in a single multicall
     */
    multicallRange: 100,

    /**
     * The number of multicalls to do in parallel
     */
    multicallBatchSize: 1,
    loadFromDisk: process.env.LOAD_MORPHO_COMPOUND_FROM_DISK?.toLowerCase() === "true",
}
class MorphoCompoundParser extends MorphoParserV1<CompoundBalanceState> {
    filename = "MorphoCompound_users.json"
    morpho: MorphoCompound;
    #lens: MorphoCompoundLens;
    constructor() {
        super(configuration);
        this.morpho = MorphoCompound__factory.connect(configuration.morphoAddress, this.provider);
        this.#lens = MorphoCompoundLens__factory.connect(configuration.lensAddress, this.provider);
    }
    init(): Promise<void> {
        return Promise.resolve();
    }
    getUserBalanceStates(user: string, blockTag: providers.BlockTag) {
        return this.#lens.getUserBalanceStates(user, [], {blockTag});
    }
    formatUserBalanceStates(user: CompoundBalanceState) {
        return {
            collateral: user.collateralValue,
            debt: user.debtValue,
        }
    }
}

// async function test() {
//     const parser = new MorphoCompoundParser();
//     await parser.main();
// }

// test();

export const Parser = MorphoCompoundParser;