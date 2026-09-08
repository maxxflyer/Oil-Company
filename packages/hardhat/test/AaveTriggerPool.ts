import { expect } from "chai";
import { network } from "hardhat";
import { Artifact_PlainTriggerPool } from "../generated/artifacts/PlainTriggerPool.js";
import { Artifact_MockCounter } from "../generated/artifacts/MockCounter.js";
import type { Abi_MockERC20 } from "../generated/abis/MockERC20.js";
import type { Abi_PoolRegistry } from "../generated/abis/PoolRegistry.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const FEE = 1_000_000_000_000_000n; // 0.001 ETH
const MILLE = 1_000n * 10n ** 18n;
const TAGLIA = 2n * 10n ** 18n; // 2 DAI a chi preme
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

  const [owner, tizio, passante] = await ethers.getSigners();

  // il bersaglio: conta le volte che lo chiamano
  const counter = await new ethers.ContractFactory(
    Artifact_MockCounter.abi,
    Artifact_MockCounter.bytecode,
    owner,
  ).deploy();
  const poke = ethers.id("poke()").slice(0, 10);

  await registry.createTriggerBarrel(
    "Sector-7 Pump",
    await dai.getAddress(),
    { flavour: 0, target: await counter.getAddress(), callData: poke, bounty: TAGLIA, ethValue: 0n },
    { value: FEE },
  );

  const tutti = await registry.getAllPools();
  const pool = await ethers.getContractAt(Artifact_PlainTriggerPool.abi, tutti[tutti.length - 1].poolAddress);

  await dai.mint(tizio.address, MILLE);
  await dai.connect(tizio).approve(await pool.getAddress(), MILLE);

  const prime = await ethers.getContractAt(Artifact_PlainTriggerPool.abi, await registry.primeBarrel());

  return { registry, dai, pool, prime, counter, poke, owner, tizio, passante };
}

describe("AaveTriggerPool", function () {
  describe("La pila", function () {
    it("nasce puntata su un bersaglio, scarica", async function () {
      const { pool, counter, poke } = await networkHelpers.loadFixture(deployFixture);

      // in ethers `.target` è l'indirizzo del contratto: la funzione va chiesta per nome
      expect(await pool.getFunction("target")()).to.equal(await counter.getAddress());
      expect(await pool.callData()).to.equal(poke);
      expect(await pool.bounty()).to.equal(TAGLIA);
      expect(await pool.shots()).to.equal(0n);
      expect(await pool.ready()).to.equal(false);
    });

    it("uno scatto costa la taglia più la decima", async function () {
      const { pool } = await networkHelpers.loadFixture(deployFixture);
      expect(await pool.shotCost()).to.equal(TAGLIA + TAGLIA / 100n);
    });

    it("scarica non scatta", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);

      await expect(pool.connect(tizio).trigger()).to.be.revertedWithCustomError(pool, "NotCharged");
      expect(await pool.shots()).to.equal(0n);
    });

    it("si carica col tempo, e la carica è il surplus", async function () {
      const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      expect(await pool.charge()).to.equal(await pool.surplus());
      expect(await pool.ready()).to.equal(true);
    });
  });

  describe("Lo scatto", function () {
    it("chiama il bersaglio e paga chi ha premuto", async function () {
      const { pool, dai, counter, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      const primaInTasca = await dai.balanceOf(passante.address);
      await pool.connect(passante).trigger();

      expect(await counter.count()).to.equal(1n);
      expect(await counter.lastCaller()).to.equal(await pool.getAddress());
      expect((await dai.balanceOf(passante.address)) - primaInTasca).to.equal(TAGLIA);
      expect(await pool.shots()).to.equal(1n);
    });

    it("la decima dello scatto va al Prime Barrel", async function () {
      const { pool, prime, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
      await prime
        .connect(tizio)
        .deposit(0n)
        .catch(() => undefined); // il Prime può essere vuoto: non importa
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      const primaNelPrime = (await prime.principal()) + (await prime.pending());
      await pool.connect(passante).trigger();

      expect((await prime.principal()) + (await prime.pending()) - primaNelPrime).to.equal(TAGLIA / 100n);
    });

    it("il capitale non si tocca: brucia solo la carica", async function () {
      const { pool, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
      const cento = 100n * 10n ** 18n;
      await pool.connect(tizio).deposit(cento);
      await networkHelpers.time.increase(ANNO);

      const caricaPrima = await pool.charge();
      await pool.connect(passante).trigger();

      expect(await pool.principal()).to.equal(cento);
      expect(await pool.charge()).to.be.closeTo(caricaPrima - (await pool.shotCost()), 10n ** 15n);
    });

    it("se il bersaglio rifiuta non scatta niente, taglia compresa", async function () {
      const { pool, dai, counter, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
      await pool.connect(tizio).deposit(100n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);
      await counter.setJammed(true);

      const primaInTasca = await dai.balanceOf(passante.address);
      await expect(pool.connect(passante).trigger()).to.be.revertedWithCustomError(pool, "ShotFailed");

      expect(await dai.balanceOf(passante.address)).to.equal(primaInTasca);
      expect(await pool.shots()).to.equal(0n);
    });

    it("si ricarica e riscatta", async function () {
      const { pool, counter, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
      // quarantacinque al 5% fanno poco più di uno scatto l'anno: si scarica davvero
      await pool.connect(tizio).deposit(45n * 10n ** 18n);
      await networkHelpers.time.increase(ANNO);

      await pool.connect(passante).trigger();
      await expect(pool.connect(passante).trigger()).to.be.revertedWithCustomError(pool, "NotCharged");

      await networkHelpers.time.increase(ANNO);
      await pool.connect(passante).trigger();

      expect(await counter.count()).to.equal(2n);
      expect(await pool.shots()).to.equal(2n);
    });
  });

  describe("Chi ha versato", function () {});
});
