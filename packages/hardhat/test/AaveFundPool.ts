import { expect } from "chai";
import { network } from "hardhat";
import { Artifact_AaveFundPool } from "../generated/artifacts/AaveFundPool.js";
import type { Abi_MockAavePool } from "../generated/abis/MockAavePool.js";
import type { Abi_MockERC20 } from "../generated/abis/MockERC20.js";
import type { Abi_PoolRegistry } from "../generated/abis/PoolRegistry.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const FEE = 1_000_000_000_000_000n; // 0.001 ETH
const AAVE = 1n; // PoolKind.AaveDai
const MILLE = 1_000n * 10n ** 18n;
const ANNO = 365 * 24 * 60 * 60;

async function deployFixture() {
  const env = await loadAndExecuteDeploymentsFromFiles({ provider });
  const registry = await ethers.getContractAt(
    env.get<Abi_PoolRegistry>("PoolRegistry").abi,
    env.get<Abi_PoolRegistry>("PoolRegistry").address,
  );
  const dai = await ethers.getContractAt(
    env.get<Abi_MockERC20>("MockDAI").abi,
    env.get<Abi_MockERC20>("MockDAI").address,
  );
  const aave = await ethers.getContractAt(
    env.get<Abi_MockAavePool>("MockAavePool").abi,
    env.get<Abi_MockAavePool>("MockAavePool").address,
  );

  const [owner, tizio, caio, cassa] = await ethers.getSigners();

  await registry.createPool("Sector-7 Crude", AAVE, await dai.getAddress(), cassa.address, { value: FEE });
  // Il primo dell'elenco è il Prime Barrel: quello appena aperto è l'ultimo.
  const tutti = await registry.getAllPools();
  const info = tutti[tutti.length - 1];
  const pool = await ethers.getContractAt(Artifact_AaveFundPool.abi, info.poolAddress);

  const primeAddress = await registry.primeBarrel();
  const prime = await ethers.getContractAt(Artifact_AaveFundPool.abi, primeAddress);

  for (const chi of [tizio, caio]) {
    await dai.mint(chi.address, MILLE);
    await dai.connect(chi).approve(await pool.getAddress(), MILLE);
    await dai.connect(chi).approve(primeAddress, MILLE);
  }

  return { registry, dai, aave, pool, prime, owner, tizio, caio, cassa };
}

describe("AaveFundPool", function () {
  describe("Versare", function () {
    it("il primo che versa riceve una quota per ogni DAI", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);

      expect(await pool.balanceOf(tizio.address)).to.equal(100n * 10n ** 18n);
      // Il saldo aDAI si ricava da un saldo scalato per un indice: l'andata e ritorno
      // arrotonda per difetto, e qualche wei si perde per strada. Succede anche in Aave.
      expect(await pool.totalAssets()).to.be.closeTo(100n * 10n ** 18n, 10n);
    });

    it("i DAI finiscono in Aave, non restano nel barile", async function () {
      const { pool, dai, aave, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);

      expect(await dai.balanceOf(await pool.getAddress())).to.equal(0n);
      expect(await dai.balanceOf(await aave.getAddress())).to.equal(100n * 10n ** 18n);
    });

    it("rifiuta il versamento vuoto", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await expect(pool.connect(tizio).deposit(0n)).to.be.revertedWithCustomError(pool, "NothingToMove");
    });
  });

  describe("Interessi", function () {
    it("il barile vale di più dopo un anno", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);

      await networkHelpers.time.increase(ANNO);

      // 5% l'anno: 100 → circa 105, e le quote restano quelle
      const valore = await pool.totalAssets();
      expect(valore).to.be.greaterThan(104n * 10n ** 18n);
      expect(valore).to.be.lessThan(106n * 10n ** 18n);
      expect(await pool.totalSupply()).to.equal(100n * 10n ** 18n);
    });

    it("chi arriva dopo riceve le stesse quote di chi c'era prima", async function () {
      const { pool, tizio, caio } = await networkHelpers.loadFixture(deployFixture);
      const cento = 100n * 10n ** 18n;

      await pool.connect(tizio).deposit(cento);
      await networkHelpers.time.increase(ANNO);
      await pool.connect(caio).deposit(cento);

      // Le quote guardano il capitale, non quanto vale il barile: stesso versamento, stesse quote
      expect(await pool.balanceOf(caio.address)).to.equal(await pool.balanceOf(tizio.address));
      expect(await pool.assetsOf(caio.address)).to.equal(cento);
      expect(await pool.assetsOf(tizio.address)).to.equal(cento);
    });
  });

  describe("Ritirare", function () {
    it("la quota si può girare a un altro, e con lei il capitale", async function () {
      const { pool, tizio, caio } = await networkHelpers.loadFixture(deployFixture);
      const cento = 100n * 10n ** 18n;
      await pool.connect(tizio).deposit(cento);

      await pool.connect(tizio).transfer(caio.address, cento);

      expect(await pool.balanceOf(tizio.address)).to.equal(0n);
      expect(await pool.assetsOf(caio.address)).to.equal(await pool.principal());
    });
  });

  describe("Capitale e surplus", function () {
    it("il barile si ricorda quanto capitale è entrato", async function () {
      const { pool, tizio, caio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await pool.connect(caio).deposit(50n * 10n ** 18n);

      expect(await pool.principal()).to.equal(150n * 10n ** 18n);
    });

    it("il surplus è quello che c'è oltre il capitale", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      expect(await pool.surplus()).to.equal(0n);

      await networkHelpers.time.increase(ANNO);

      // 5% su cento: circa cinque
      const surplus = await pool.surplus();
      expect(surplus).to.be.greaterThan(4n * 10n ** 18n);
      expect(surplus).to.be.lessThan(6n * 10n ** 18n);
    });

    it("bruciare manda il surplus all'indirizzo scelto, meno la decima, e lascia il capitale", async function () {
      const { pool, dai, tizio, cassa } = await networkHelpers.loadFixture(deployFixture);
      const cento = 100n * 10n ** 18n;
      await pool.connect(tizio).deposit(cento);
      await networkHelpers.time.increase(ANNO);

      const surplus = await pool.surplus();
      await pool.connect(tizio).burnSurplus();

      // il 99%: l'1% è la decima del Prime Barrel
      expect(await dai.balanceOf(cassa.address)).to.be.closeTo((surplus * 99n) / 100n, 10n ** 15n);
      expect(await pool.surplus()).to.be.lessThan(10n ** 12n);
      expect(await pool.totalAssets()).to.be.closeTo(cento, 10n ** 15n);
    });

    it("in un barile vuoto non c'è niente da bruciare", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await expect(pool.connect(tizio).burnSurplus()).to.be.revertedWithCustomError(pool, "NoSurplus");
    });
  });

  describe("La decima al Prime Barrel", function () {
    it("l'uno per cento del surplus va al Prime Barrel", async function () {
      const { pool, prime, tizio } = await networkHelpers.loadFixture(deployFixture);
      // il Prime Barrel ha già un investitore: la decima entra subito, non aspetta
      await prime.connect(tizio).deposit(10n * 10n ** 18n);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      const surplus = await pool.surplus();
      const primaNelPrime = await prime.totalAssets();
      await pool.connect(tizio).burnSurplus();

      expect((await prime.totalAssets()) - primaNelPrime).to.be.closeTo(surplus / 100n, 10n ** 15n);
    });

    it("quell'uno per cento è capitale, non surplus", async function () {
      const { pool, prime, tizio } = await networkHelpers.loadFixture(deployFixture);
      // il Prime Barrel ha già un investitore, così la decima entra subito nel capitale
      await prime.connect(tizio).deposit(10n * 10n ** 18n);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      const surplus = await pool.surplus();
      const capitalePrima = await prime.principal();
      await pool.connect(tizio).burnSurplus();

      expect((await prime.principal()) - capitalePrima).to.be.closeTo(surplus / 100n, 10n ** 15n);
      expect(await prime.pending()).to.equal(0n);
    });

    it("il Prime Barrel non paga la decima a sé stesso", async function () {
      const { prime, dai, tizio } = await networkHelpers.loadFixture(deployFixture);
      await dai.mint(tizio.address, MILLE);
      await dai.connect(tizio).approve(await prime.getAddress(), MILLE);
      await prime.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      expect(await prime.primeBarrel()).to.equal("0x0000000000000000000000000000000000000000");

      const surplus = await prime.surplus();
      const capitalePrima = await prime.principal();
      await prime.connect(tizio).burnSurplus();

      // tutto il surplus se n'è andato al meccanismo esterno, il capitale non si muove
      expect(await prime.principal()).to.equal(capitalePrima);
      expect(surplus).to.be.greaterThan(0n);
    });

    it("la decima di un barile su un altro token resta in cassa al Prime Barrel", async function () {
      const { registry, prime, aave, tizio, cassa } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const usdc = reserves.find((r: { symbol: string }) => r.symbol === "USDC");

      await registry.createPool("Barile USDC", AAVE, usdc.token, cassa.address, { value: FEE });
      const tutti = await registry.getAllPools();
      const info = tutti[tutti.length - 1];
      const poolUsdc = await ethers.getContractAt(Artifact_AaveFundPool.abi, info.poolAddress);

      const token = await ethers.getContractAt(
        [
          "function mint(address,uint256)",
          "function approve(address,uint256)",
          "function balanceOf(address) view returns (uint256)",
        ],
        usdc.token,
      );
      const mille = 1_000n * 10n ** 6n;
      await token.mint(tizio.address, mille);
      await token.connect(tizio).approve(await poolUsdc.getAddress(), mille);
      await poolUsdc.connect(tizio).deposit(200n * 10n ** 6n);

      await networkHelpers.time.increase(ANNO);
      const surplus = await poolUsdc.surplus();
      await poolUsdc.connect(tizio).burnSurplus();

      // gli USDC sono arrivati al Prime Barrel, ma non contano come capitale: aspettano
      expect(await prime.foreignBalanceOf(usdc.token)).to.be.closeTo(surplus / 100n, 10n ** 4n);
      expect(await prime.principal()).to.equal(0n);
      expect(aave).to.not.equal(undefined);
    });

    it("i token estranei si cambiano in DAI da Uniswap, ed entrano nel capitale", async function () {
      const { registry, prime, tizio, cassa } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const usdc = reserves.find((r: { symbol: string }) => r.symbol === "USDC");

      // un barile in USDC che brucia lascia la sua decima in USDC al Prime Barrel
      await registry.createPool("Barile USDC", AAVE, usdc.token, cassa.address, { value: FEE });
      const tutti = await registry.getAllPools();
      const poolUsdc = await ethers.getContractAt(Artifact_AaveFundPool.abi, tutti[tutti.length - 1].poolAddress);

      const token = await ethers.getContractAt(
        [
          "function mint(address,uint256)",
          "function approve(address,uint256)",
          "function balanceOf(address) view returns (uint256)",
        ],
        usdc.token,
      );
      await token.mint(tizio.address, 1_000n * 10n ** 6n);
      await token.connect(tizio).approve(await poolUsdc.getAddress(), 1_000n * 10n ** 6n);
      await poolUsdc.connect(tizio).deposit(200n * 10n ** 6n);
      await networkHelpers.time.increase(ANNO);
      await poolUsdc.connect(tizio).burnSurplus();

      // il Prime Barrel ha già un investitore, così il ricavato entra subito nel capitale
      await prime.connect(tizio).deposit(10n * 10n ** 18n);

      const [trovati, quanti] = await registry.foreignHoldings(await prime.getAddress());
      expect(trovati.length).to.equal(1);
      expect(trovati[0].symbol).to.equal("USDC");
      expect(quanti[0]).to.be.greaterThan(0n);

      const capitalePrima = await prime.principal();
      await prime.connect(tizio).convertForeign([usdc.token], [0n]);

      // un USDC vale un dollaro come il DAI: il capitale cresce di quanto c'era, in scala 18
      const atteso = quanti[0] * 10n ** 12n;
      expect((await prime.principal()) - capitalePrima).to.be.closeTo(atteso, 10n ** 12n);
      expect(await prime.foreignBalanceOf(usdc.token)).to.equal(0n);
    });

    it("il barile sa quali monete straniere ha in cassa, perché chi gliele manda si annuncia", async function () {
      const { registry, prime, tizio, cassa } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const usdc = reserves.find((r: { symbol: string }) => r.symbol === "USDC");

      expect(await prime.foreignTokensCount()).to.equal(0n);

      await registry.createPool("Barile USDC", AAVE, usdc.token, cassa.address, { value: FEE });
      const tutti = await registry.getAllPools();
      const poolUsdc = await ethers.getContractAt(Artifact_AaveFundPool.abi, tutti[tutti.length - 1].poolAddress);

      const token = await ethers.getContractAt(
        ["function mint(address,uint256)", "function approve(address,uint256)", "function transfer(address,uint256)"],
        usdc.token,
      );
      await token.mint(tizio.address, 1_000n * 10n ** 6n);
      await token.connect(tizio).approve(await poolUsdc.getAddress(), 1_000n * 10n ** 6n);
      await poolUsdc.connect(tizio).deposit(200n * 10n ** 6n);
      await networkHelpers.time.increase(ANNO);
      await poolUsdc.connect(tizio).burnSurplus();

      expect(await prime.foreignTokensList()).to.deep.equal([ethers.getAddress(usdc.token)]);
    });

    it("solo un barile del registro può annunciare una decima", async function () {
      const { registry, prime, tizio } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const usdc = reserves.find((r: { symbol: string }) => r.symbol === "USDC");

      await expect(prime.connect(tizio).receiveForeign(usdc.token, 1n)).to.be.revertedWithCustomError(
        prime,
        "NotABarrel",
      );
    });

    it("un token arrivato per vie traverse si segnala a mano", async function () {
      const { registry, prime, tizio } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const link = reserves.find((r: { symbol: string }) => r.symbol === "LINK");

      const token = await ethers.getContractAt(
        ["function mint(address,uint256)", "function transfer(address,uint256)"],
        link.token,
      );
      // nessuno si annuncia: arrivano e basta
      await token.mint(tizio.address, 5n * 10n ** 18n);
      await token.connect(tizio).transfer(await prime.getAddress(), 5n * 10n ** 18n);

      expect(await prime.foreignTokensCount()).to.equal(0n);

      await prime.connect(tizio).noteForeign(link.token);

      expect(await prime.foreignTokensList()).to.deep.equal([ethers.getAddress(link.token)]);
      const [trovati] = await registry.foreignHoldings(await prime.getAddress());
      expect(trovati[0].symbol).to.equal("LINK");
    });

    it("non si segnala un token che non c'è", async function () {
      const { registry, prime } = await networkHelpers.loadFixture(deployFixture);
      const reserves = await registry.getAssets();
      const crv = reserves.find((r: { symbol: string }) => r.symbol === "CRV");

      await expect(prime.noteForeign(crv.token)).to.be.revertedWithCustomError(prime, "NothingThere");
    });

    it("il token del barile non è un token estraneo", async function () {
      const { prime, dai } = await networkHelpers.loadFixture(deployFixture);
      await expect(prime.convertForeign([await dai.getAddress()], [0n])).to.be.revertedWithCustomError(
        prime,
        "NotForeign",
      );
    });

    it("una decima arrivata a barile vuoto aspetta, e entra col primo che versa", async function () {
      const { pool, prime, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);
      await pool.connect(tizio).burnSurplus();

      // il Prime Barrel non ha ancora quote: la decima è ferma in attesa
      const inAttesa = await prime.pending();
      expect(inAttesa).to.be.greaterThan(0n);
      expect(await prime.principal()).to.equal(0n);

      // arriva il primo investitore e la decima entra nel capitale
      await prime.connect(tizio).deposit(50n * 10n ** 18n);
      expect(await prime.pending()).to.equal(0n);
      expect(await prime.principal()).to.equal(50n * 10n ** 18n + inAttesa);
    });
  });

  describe("Il registro", function () {
    it("racconta quanto vale il barile", async function () {
      const { registry, pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);

      const tutti = await registry.getAllPools();
      const info = tutti[tutti.length - 1];
      expect(info.totalAssets).to.be.closeTo(100n * 10n ** 18n, 10n);
      expect(info.principal).to.equal(100n * 10n ** 18n);
      expect(info.name).to.equal("Sector-7 Crude");
      expect(info.assetSymbol).to.equal("DAI");
    });
  });
});
