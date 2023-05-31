import { constants, providers } from 'ethers';

import { WadRayMath } from '@morpho-labs/ethers-utils/lib/maths';
import {
  ChainlinkPriceFeed__factory,
  MorphoAaveV2,
  MorphoAaveV2__factory,
  MorphoAaveV2Lens,
  MorphoAaveV2Lens__factory,
} from '@morpho-labs/morpho-ethers-contract';
import { Types } from '@morpho-labs/morpho-ethers-contract/lib/aave-v2/mainnet/MorphoAaveV2Lens';
import addresses from '@morpho-labs/morpho-ethers-contract/lib/addresses';

import { MorphoParser, MorphoParserV1 } from './MorphoParser';

const configuration = {
  /**
   * The address of the morpho contract
   */
  morphoAddress: addresses.morphoAaveV2.morpho,

  /**
   * The address of the lens contract
   */
  lensAddress: addresses.morphoAaveV2.lens,

  /**
   * The deployment block of the MorphoAaveV2 contract
   */
  deploymentBlock: 15383036,

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
  loadFromDisk: process.env.LOAD_MORPHO_AAVEV2_FROM_DISK?.toLowerCase() === 'true',
};

class MorphoAaveV2Parser extends MorphoParserV1<Types.LiquidityDataStructOutput> {
  filename = 'MorphoAaveV2_users.json';
  morpho: MorphoAaveV2;
  #lens: MorphoAaveV2Lens;
  #ethPrice = constants.Zero;
  constructor() {
    super(configuration);
    this.morpho = MorphoAaveV2__factory.connect(configuration.morphoAddress, this.provider);
    this.#lens = MorphoAaveV2Lens__factory.connect(configuration.lensAddress, this.provider);
  }
  init() {
    return this.#fetchEthPrice('latest');
  }

  getUserBalanceStates(user: string, blockTag: providers.BlockTag) {
    return this.#lens.getUserBalanceStates(user, { blockTag });
  }
  formatUserBalanceStates(user: Types.LiquidityDataStructOutput) {
    return {
      collateral: WadRayMath.wadMul(user.collateralEth, this.#ethPrice),
      debt: WadRayMath.wadMul(user.debtEth, this.#ethPrice),
    };
  }

  async #fetchEthPrice(blockTag: providers.BlockTag) {
    const CHAINLINK_ETH_USD_PRICE_FEED_ADDRESS = '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419';

    const chainlinkEthUsdPriceFeed = ChainlinkPriceFeed__factory.connect(
      CHAINLINK_ETH_USD_PRICE_FEED_ADDRESS,
      this.provider
    );

    this.#ethPrice = await chainlinkEthUsdPriceFeed.latestRoundData({ blockTag }).then(
      ({ answer }) => answer.mul(10 ** 10) // The price feed is in 8 decimals
    );
  }
}

export const Parser = MorphoAaveV2Parser;
