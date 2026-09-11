import { expect } from "chai";
import { network } from "hardhat";
import { Artifact_AaveFundPool } from "../generated/artifacts/AaveFundPool.js";
import { Artifact_PrimeShareNFT } from "../generated/artifacts/PrimeShareNFT.js";
import type { Abi_MockERC20 } from "../generated/abis/MockERC20.js";
import type { Abi_PoolRegistry } from "../generated/abis/PoolRegistry.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const CENTO = 100n * 10n ** 18n;
const MILLE = 1_000n * 10n ** 18n;

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

  const primeAddress = await registry.primeBarrel();
  const prime = await ethers.getContractAt(Artifact_AaveFundPool.abi, primeAddress);
  const nft = await ethers.getContractAt(Artifact_PrimeShareNFT.abi, await prime.shareNft());

  const [owner, tizio, caio] = await ethers.getSigners();
  for (const chi of [tizio, caio]) {
    await dai.mint(chi.address, MILLE);
    await dai.connect(chi).approve(primeAddress, MILLE);
  }

  return { registry, dai, prime, nft, owner, tizio, caio };
}

describe("PrimeShareNFT", function () {
  it("il Prime Barrel nasce col titolo attaccato, uno ogni cento", async function () {
    const { prime, nft } = await networkHelpers.loadFixture(deployFixture);

    expect(await prime.shareNftEvery()).to.equal(CENTO);
    expect(await nft.barrel()).to.equal(await prime.getAddress());
    expect(await nft.totalSupply()).to.equal(0n);
  });

  it("chi versa cento riceve un titolo", async function () {
    const { prime, nft, tizio } = await networkHelpers.loadFixture(deployFixture);
    await prime.connect(tizio).deposit(CENTO);

    expect(await nft.balanceOf(tizio.address)).to.equal(1n);
    expect(await nft.ownerOf(1n)).to.equal(tizio.address);
  });

  it("chi versa duecentocinquanta ne riceve due, e il resto resta lì ad aspettare", async function () {
    const { prime, nft, tizio } = await networkHelpers.loadFixture(deployFixture);
    await prime.connect(tizio).deposit(250n * 10n ** 18n);

    expect(await nft.balanceOf(tizio.address)).to.equal(2n);
    // mancano cinquanta al terzo
    expect(await prime.toNextShare(tizio.address)).to.equal(50n * 10n ** 18n);
  });

  it("i versamenti si sommano: due da cinquanta fanno un titolo", async function () {
    const { prime, nft, tizio } = await networkHelpers.loadFixture(deployFixture);
    await prime.connect(tizio).deposit(50n * 10n ** 18n);
    expect(await nft.balanceOf(tizio.address)).to.equal(0n);

    await prime.connect(tizio).deposit(50n * 10n ** 18n);
    expect(await nft.balanceOf(tizio.address)).to.equal(1n);
  });

  it("il titolo si può regalare, e il voto va con lui", async function () {
    const { prime, nft, tizio, caio } = await networkHelpers.loadFixture(deployFixture);
    await prime.connect(tizio).deposit(CENTO);

    await nft.connect(tizio).transferFrom(tizio.address, caio.address, 1n);

    expect(await nft.balanceOf(tizio.address)).to.equal(0n);
    expect(await nft.ownerOf(1n)).to.equal(caio.address);
  });

  it("regalarlo non ne fa nascere un altro: si contano i versamenti, non quanti se ne hanno", async function () {
    const { prime, nft, tizio, caio } = await networkHelpers.loadFixture(deployFixture);
    await prime.connect(tizio).deposit(CENTO);
    await nft.connect(tizio).transferFrom(tizio.address, caio.address, 1n);

    await prime.connect(tizio).deposit(50n * 10n ** 18n);
    expect(await nft.balanceOf(tizio.address)).to.equal(0n);

    await prime.connect(tizio).deposit(50n * 10n ** 18n);
    expect(await nft.balanceOf(tizio.address)).to.equal(1n);
    expect(await nft.totalSupply()).to.equal(2n);
  });

  it("solo il barile può coniare titoli", async function () {
    const { nft, tizio } = await networkHelpers.loadFixture(deployFixture);
    await expect(nft.connect(tizio).mint(tizio.address)).to.be.revertedWithCustomError(nft, "OnlyBarrel");
  });

  it("gli altri barili non danno titoli", async function () {
    const { registry, dai } = await networkHelpers.loadFixture(deployFixture);
    const [, , , cassa] = await ethers.getSigners();
    await registry.createPool("Senza titoli", 1n, await dai.getAddress(), cassa.address, {
      value: 1_000_000_000_000_000n,
    });

    const tutti = await registry.getAllPools();
    expect(tutti[tutti.length - 1].shareNft).to.equal("0x0000000000000000000000000000000000000000");
  });
});

const CENTO_USDC = 100n * 10n ** 6n;
const MILLE_USDC = 1_000n * 10n ** 6n;

/// Il barile con cui si lancia l'Omnistaker: come il Prime, ma in USDC.
async function omnistakerFixture() {
  const env = await loadAndExecuteDeploymentsFromFiles({ provider });
  const registry = await ethers.getContractAt(
    env.get<Abi_PoolRegistry>("PoolRegistry").abi,
    env.get<Abi_PoolRegistry>("PoolRegistry").address,
  );
  const usdc = await ethers.getContractAt(
    env.get<Abi_MockERC20>("MockUSDC").abi,
    env.get<Abi_MockERC20>("MockUSDC").address,
  );

  const tutti = await registry.getAllPools();
  const info = tutti.find((barile: { name: string }) => barile.name === "Omnistaker");
  const barrel = await ethers.getContractAt(Artifact_AaveFundPool.abi, info.poolAddress);
  const nft = await ethers.getContractAt(Artifact_PrimeShareNFT.abi, info.shareNft);

  const [owner, tizio, caio] = await ethers.getSigners();
  for (const chi of [tizio, caio]) {
    await usdc.mint(chi.address, MILLE_USDC);
    await usdc.connect(chi).approve(info.poolAddress, MILLE_USDC);
  }

  return { registry, usdc, barrel, nft, owner, tizio, caio };
}

describe("Il barile dell'Omnistaker", function () {
  it("nasce col suo titolo attaccato, uno ogni cento USDC", async function () {
    const { barrel, nft } = await networkHelpers.loadFixture(omnistakerFixture);

    expect(await barrel.shareNftEvery()).to.equal(CENTO_USDC);
    expect(await nft.barrel()).to.equal(await barrel.getAddress());
    expect(await nft.symbol()).to.equal("OMNIP");
  });

  it("chi versa cento USDC riceve un titolo, e i versamenti si sommano", async function () {
    const { barrel, nft, tizio } = await networkHelpers.loadFixture(omnistakerFixture);

    await barrel.connect(tizio).deposit(60n * 10n ** 6n);
    expect(await nft.balanceOf(tizio.address)).to.equal(0n);

    await barrel.connect(tizio).deposit(40n * 10n ** 6n);
    expect(await nft.balanceOf(tizio.address)).to.equal(1n);
  });

  it("è un titolo suo: quello del Prime Barrel resta dov'è", async function () {
    const { registry, barrel, nft, tizio } = await networkHelpers.loadFixture(omnistakerFixture);
    const prime = await ethers.getContractAt(Artifact_AaveFundPool.abi, await registry.primeBarrel());

    await barrel.connect(tizio).deposit(CENTO_USDC);

    expect(await nft.totalSupply()).to.equal(1n);
    expect(await prime.shareNft()).to.not.equal(await barrel.shareNft());
  });

  it("il titolo lo attacca chi ha aperto il barile, non un altro", async function () {
    const { registry, barrel, tizio } = await networkHelpers.loadFixture(omnistakerFixture);

    await expect(
      registry.connect(tizio).setShareNft(await barrel.getAddress(), tizio.address, CENTO_USDC),
    ).to.be.revertedWithCustomError(registry, "NotCreator");
  });

  it("attaccato una volta, non si cambia più", async function () {
    const { registry, barrel, owner } = await networkHelpers.loadFixture(omnistakerFixture);

    await expect(
      registry.connect(owner).setShareNft(await barrel.getAddress(), owner.address, CENTO_USDC),
    ).to.be.revertedWithCustomError(barrel, "ShareNftAlreadySet");
  });
});
