import { deployScript, artifacts } from "../rocketh/deploy.js";

const RAY_PERCENT = 10_000_000_000_000_000_000_000_000n; // 1% in ray
const ZERO = "0x0000000000000000000000000000000000000000";
/// Il nome del barile con cui si lancia l'Omnistaker: da qui lo si ritrova.
const OMNISTAKER = "Omnistaker";

/**
 * Dove il Prime Barrel manda il proprio surplus: il meccanismo che lo ridistribuisce
 * agli investitori. Finché non esiste, un indirizzo di Hardhat che si vede riempire.
 */
const EXTERNAL_MECHANISM = "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720";

/**
 * Deploys the local Aave stand-in (mock lending pool + a few mock tokens) and the pool
 * registry. The registry owner is the deployer and a pool costs 0.001 ETH to open.
 *
 * @param env Rocketh environment object.
 */
export default deployScript(
  async env => {
    const { deployer } = env.namedAccounts;

    /**
     * Chi comanda. Di norma è l'account che firma il deploy, ma quello è una chiave di
     * Hardhat, non il portafoglio di nessuno: con `OWNER_ADDRESS` nel `.env` si dice
     * a chi devono restare le chiavi di casa.
     */
    const owner = (process.env.OWNER_ADDRESS as `0x${string}` | undefined) || deployer;

    const aave = await env.deploy("MockAavePool", {
      account: deployer,
      artifact: artifacts.MockAavePool,
      args: [5n * RAY_PERCENT], // 5% a year
    });

    const registry = await env.deploy("PoolRegistry", {
      account: deployer,
      artifact: artifacts.PoolRegistry,
      args: [owner, 1_000_000_000_000_000n, aave.address], // owner, 0.001 ETH, Aave
    });

    // Le riserve di Aave: in locale ce le apriamo noi, con i decimali di quelle vere.
    const tokens = [
      { name: "MockDAI", label: "Mock Dai Stablecoin", symbol: "DAI", usd: 1, decimals: 18 },
      { name: "MockUSDC", label: "Mock USD Coin", symbol: "USDC", usd: 1, decimals: 6 },
      { name: "MockUSDT", label: "Mock Tether USD", symbol: "USDT", usd: 1, decimals: 6 },
      { name: "MockWstETH", label: "Mock Wrapped stETH", symbol: "wstETH", usd: 3500, decimals: 18 },
      { name: "MockWBTC", label: "Mock Wrapped BTC", symbol: "WBTC", usd: 60000, decimals: 8 },
      { name: "MockLINK", label: "Mock Chainlink", symbol: "LINK", usd: 15, decimals: 18 },
      { name: "MockAAVE", label: "Mock Aave Token", symbol: "AAVE", usd: 150, decimals: 18 },
      { name: "MockLUSD", label: "Mock Liquity USD", symbol: "LUSD", usd: 1, decimals: 18 },
      { name: "MockCRV", label: "Mock Curve DAO", symbol: "CRV", usd: 0.5, decimals: 18 },
      { name: "MockUNI", label: "Mock Uniswap", symbol: "UNI", usd: 8, decimals: 18 },
      { name: "MockGHO", label: "Mock GHO", symbol: "GHO", usd: 1, decimals: 18 },
    ];

    // Il WETH non è un token come gli altri: dietro ci deve stare dell'ETH vero, se no
    // i barili che allegano ETH non riescono a srotolarlo.
    const weth = await env.deploy("MockWETH", { account: deployer, artifact: artifacts.MockWETH, args: [] });
    const inCassa = await env.read(weth, { functionName: "totalSupply" });
    if (inCassa === 0n) {
      await env.execute(weth, { account: deployer, functionName: "deposit", args: [], value: 500n * 10n ** 18n });
    }

    for (const token of tokens) {
      const deployed = await env.deploy(token.name, {
        account: deployer,
        artifact: artifacts.MockERC20,
        args: [token.label, token.symbol, token.decimals],
      });

      // La riserva su Aave si apre una volta sola: al secondo deploy c'è già.
      const aToken = await env.read(aave, { functionName: "aTokenOf", args: [deployed.address] });
      if (aToken === "0x0000000000000000000000000000000000000000") {
        await env.execute(aave, { account: deployer, functionName: "listAsset", args: [deployed.address] });
      }
    }

    // Il WETH sta fra le riserve come gli altri, e il registro deve sapere qual è.
    const wethAToken = await env.read(aave, { functionName: "aTokenOf", args: [weth.address] });
    if (wethAToken === "0x0000000000000000000000000000000000000000") {
      await env.execute(aave, { account: deployer, functionName: "listAsset", args: [weth.address] });
    }
    if ((await env.read(registry, { functionName: "weth" })) !== weth.address) {
      await env.execute(registry, { account: deployer, functionName: "setWeth", args: [weth.address] });
    }

    const reserves = await env.read(aave, { functionName: "getReservesList" });
    console.log(`🪙  ${reserves.length} riserve aperte su Aave: ${["WETH", ...tokens.map(t => t.symbol)].join(" · ")}`);

    // Le fabbriche: il registro non costruisce i barili da sé, sarebbe troppo grosso.
    const fundFactory = await env.deploy("FundBarrelFactory", {
      account: deployer,
      artifact: artifacts.FundBarrelFactory,
      args: [],
    });
    const plainTrigger = await env.deploy("PlainTriggerFactory", {
      account: deployer,
      artifact: artifacts.PlainTriggerFactory,
      args: [],
    });
    const ethTrigger = await env.deploy("EthTriggerFactory", {
      account: deployer,
      artifact: artifacts.EthTriggerFactory,
      args: [],
    });

    const fundInUso = await env.read(registry, { functionName: "fundFactory" });
    if (fundInUso !== fundFactory.address) {
      await env.execute(registry, {
        account: deployer,
        functionName: "setFundFactory",
        args: [fundFactory.address],
      });
    }

    for (const [flavour, factory] of [
      [0, plainTrigger.address],
      [1, ethTrigger.address],
    ] as const) {
      const inUso = await env.read(registry, { functionName: "triggerFactoryOf", args: [flavour] });
      if (inUso !== factory) {
        await env.execute(registry, {
          account: deployer,
          functionName: "setTriggerFactory",
          args: [flavour, factory],
        });
      }
    }

    // Uniswap finto: serve ai barili per cambiare in casa i token che non sono i loro.
    const router = await env.deploy("MockUniswapRouter", {
      account: deployer,
      artifact: artifacts.MockUniswapRouter,
      args: [],
    });

    const routerInUso = await env.read(registry, { functionName: "swapRouter" });
    if (routerInUso !== router.address) {
      await env.execute(registry, { account: deployer, functionName: "setSwapRouter", args: [router.address] });
    }

    // Prezzi in dollari, diciotto decimali: bastano a far tornare i conti del cambio.
    for (const token of tokens) {
      const deployed = env.get(token.name);
      const price = BigInt(Math.round(token.usd * 1000)) * 10n ** 15n;
      const inUso = await env.read(router, { functionName: "priceOf", args: [deployed.address] });
      if (inUso !== price) {
        await env.execute(router, { account: deployer, functionName: "setPrice", args: [deployed.address, price] });
      }
    }
    const prezzoWeth = 3_000n * 10n ** 18n;
    if ((await env.read(router, { functionName: "priceOf", args: [weth.address] })) !== prezzoWeth) {
      await env.execute(router, { account: deployer, functionName: "setPrice", args: [weth.address, prezzoWeth] });
    }

    console.log("💱 Uniswap stand-in:", router.address, "— WETH:", weth.address);

    // Il Prime Barrel: raccoglie in DAI e manda il suo surplus al meccanismo esterno.
    const primeBarrel = await env.read(registry, { functionName: "primeBarrel" });
    if (primeBarrel === ZERO) {
      const dai = env.get("MockDAI").address;
      await env.execute(registry, {
        account: deployer,
        functionName: "createPrimeBarrel",
        args: ["Oil Company", dai, EXTERNAL_MECHANISM],
      });
      console.log("🛢  Prime Barrel:", await env.read(registry, { functionName: "primeBarrel" }));
    }

    // Il titolo della PRIME DAO: uno ogni cento DAI versati nel Prime Barrel.
    const prime = await env.read(registry, { functionName: "primeBarrel" });
    const attaccato = await env.read(registry, { functionName: "getPoolInfo", args: [prime] });
    if (attaccato.shareNft === ZERO) {
      const shareNft = await env.deploy("PrimeShareNFT", {
        account: deployer,
        artifact: artifacts.PrimeShareNFT,
        args: [prime, "Oil Company Prime Share", "PRIME"],
      });
      await env.execute(registry, {
        account: deployer,
        functionName: "setShareNft",
        args: [prime, shareNft.address, 100n * 10n ** 18n],
      });
      console.log("🎟  PRIME DAO share:", shareNft.address, "— one every 100 DAI");
    }

    /**
     * Il barile dell'Omnistaker: è così che l'Omnistaker si lancia, con un barile fatto
     * come il Prime. Raccoglie USDC e consegna un titolo ogni cento versati; il capitale
     * frutta in Aave e non si muove, e il surplus, quando qualcuno lo brucia, va alla
     * cassa dell'Omnistaker — per ora l'account che comanda.
     */
    const omnistakerBarrel = async () =>
      (await env.read(registry, { functionName: "getAllPools" })).find(barile => barile.name === OMNISTAKER);

    let omni = await omnistakerBarrel();
    if (!omni) {
      await env.execute(registry, {
        account: deployer,
        functionName: "createPool",
        args: [OMNISTAKER, 1, env.get("MockUSDC").address, owner], // tipo 1: frutta in Aave
        value: await env.read(registry, { functionName: "creationFee" }),
      });
      omni = await omnistakerBarrel();
      console.log("🪙  Omnistaker barrel:", omni?.poolAddress, "— USDC");
    }

    if (omni && omni.shareNft === ZERO) {
      const omniShare = await env.deploy("OmnistakerShareNFT", {
        account: deployer,
        artifact: artifacts.PrimeShareNFT,
        args: [omni.poolAddress, "Omnistaker Prime Share", "OMNIP"],
      });
      await env.execute(registry, {
        account: deployer,
        functionName: "setShareNft",
        args: [omni.poolAddress, omniShare.address, 100n * 10n ** 6n], // USDC ha sei cifre
      });
      console.log("🎟  Omnistaker share:", omniShare.address, "— one every 100 USDC");
    }

    // Un bersaglio per provare le pile: conta le volte che lo chiamano.
    const counter = await env.deploy("MockCounter", {
      account: deployer,
      artifact: artifacts.MockCounter,
      args: [],
    });
    console.log("🎯 Target for trigger barrels:", counter.address, "— poke() or pay()");

    const fee = await env.read(registry, { functionName: "creationFee" });
    console.log("🛢  Pool registry ready — creation fee:", fee, "wei");
  },
  {
    tags: ["PoolRegistry"],
  },
);
