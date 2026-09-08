import { expect } from "chai";
import { network } from "hardhat";
import { Artifact_EthTriggerPool } from "../generated/artifacts/EthTriggerPool.js";
import { Artifact_MockCounter } from "../generated/artifacts/MockCounter.js";
import type { Abi_MockERC20 } from "../generated/abis/MockERC20.js";
import type { Abi_PoolRegistry } from "../generated/abis/PoolRegistry.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const FEE = 1_000_000_000_000_000n; // 0.001 ETH
const MILLE = 10_000n * 10n ** 18n;
const TAGLIA = 2n * 10n ** 18n; // 2 DAI a chi preme
const ETH_DA_ALLEGARE = 10n ** 17n; // 0,1 ETH
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

  const counter = await new ethers.ContractFactory(
    Artifact_MockCounter.abi,
    Artifact_MockCounter.bytecode,
    owner,
  ).deploy();
  const pay = ethers.id("pay()").slice(0, 10);

  await registry.createTriggerBarrel(
    "Gas Station",
    await dai.getAddress(),
    { flavour: 1, target: await counter.getAddress(), callData: pay, bounty: TAGLIA, ethValue: ETH_DA_ALLEGARE },
    { value: FEE },
  );
  const tutti = await registry.getAllPools();
  const info = tutti[tutti.length - 1];
  const pool = await ethers.getContractAt(Artifact_EthTriggerPool.abi, info.poolAddress);

  await dai.mint(tizio.address, MILLE);
  await dai.connect(tizio).approve(await pool.getAddress(), MILLE);

  return { registry, dai, pool, counter, owner, tizio, passante, info };
}

describe("EthTriggerPool", function () {
  it("è il sottotipo uno, e sa quanto ETH deve allegare", async function () {
    const { pool } = await networkHelpers.loadFixture(deployFixture);

    expect(await pool.flavour()).to.equal(1n);
    expect(await pool.ethValue()).to.equal(ETH_DA_ALLEGARE);
  });

  it("uno scatto costa la taglia più l'ETH da comprare", async function () {
    const { pool } = await networkHelpers.loadFixture(deployFixture);

    // 0,1 ETH a tremila dollari fanno trecento DAI, più due di taglia e la decima
    const extra = await pool.extraCost();
    expect(extra).to.be.closeTo(300n * 10n ** 18n, 10n ** 18n);
    expect(await pool.shotCost()).to.equal(TAGLIA + extra + TAGLIA / 100n);
  });

  it("con poca carica non scatta", async function () {
    const { pool, tizio } = await networkHelpers.loadFixture(deployFixture);
    await pool.connect(tizio).deposit(1_000n * 10n ** 18n);
    await networkHelpers.time.increase(ANNO);

    // il 5% di mille fa cinquanta: non bastano per trecento di ETH
    await expect(pool.connect(tizio).trigger()).to.be.revertedWithCustomError(pool, "NotCharged");
  });

  it("quando è carica compra l'ETH e lo allega alla chiamata", async function () {
    const { pool, dai, counter, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
    await pool.connect(tizio).deposit(7_000n * 10n ** 18n);
    await networkHelpers.time.increase(ANNO);

    expect(await pool.ready()).to.equal(true);
    const primaInTasca = await dai.balanceOf(passante.address);
    await pool.connect(passante).trigger();

    expect(await counter.count()).to.equal(1n);
    expect(await counter.collected()).to.equal(ETH_DA_ALLEGARE);
    expect((await dai.balanceOf(passante.address)) - primaInTasca).to.equal(TAGLIA);
    expect(await pool.shots()).to.equal(1n);
  });

  it("il capitale resta intero anche dopo aver comprato l'ETH", async function () {
    const { pool, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
    const versati = 7_000n * 10n ** 18n;
    await pool.connect(tizio).deposit(versati);
    await networkHelpers.time.increase(ANNO);
    await pool.connect(passante).trigger();

    expect(await pool.principal()).to.equal(versati);
  });

  it("il barile non tiene ETH per sé: quello comprato se ne va tutto nella chiamata", async function () {
    const { pool, tizio, passante } = await networkHelpers.loadFixture(deployFixture);
    await pool.connect(tizio).deposit(7_000n * 10n ** 18n);
    await networkHelpers.time.increase(ANNO);
    await pool.connect(passante).trigger();

    expect(await ethers.provider.getBalance(await pool.getAddress())).to.equal(0n);
  });
});
