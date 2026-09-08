import { expect } from "chai";
import { network } from "hardhat";
import type { Abi_MockERC20 } from "../generated/abis/MockERC20.js";
import type { Abi_PoolRegistry } from "../generated/abis/PoolRegistry.js";
import { loadAndExecuteDeploymentsFromFiles } from "../rocketh/environment.js";

const { provider, networkHelpers, ethers } = await network.create();

const FEE = 1_000_000_000_000_000n; // 0.001 ETH
const BASIC = 0n; // PoolKind.Basic
const AAVE = 1n; // PoolKind.AaveDai
const ZERO = "0x0000000000000000000000000000000000000000";

async function deployFixture() {
  const env = await loadAndExecuteDeploymentsFromFiles({ provider });
  const { address, abi } = env.get<Abi_PoolRegistry>("PoolRegistry");
  const registry = await ethers.getContractAt(abi, address);
  const dai = env.get<Abi_MockERC20>("MockDAI").address;
  const [owner, stranger] = await ethers.getSigners();
  return { registry, dai, owner, stranger };
}

describe("PoolRegistry", function () {
  describe("Apertura di un barrel", function () {
    it("parte col solo Prime Barrel e la tariffa del deploy", async function () {
      const { registry } = await networkHelpers.loadFixture(deployFixture);
      expect(await registry.poolsCount()).to.equal(1n);
      expect(await registry.creationFee()).to.equal(FEE);

      const [primo] = await registry.getAllPools();
      expect(primo.isPrime).to.equal(true);
      expect(primo.name).to.equal("Oil Company");
      expect(primo.poolAddress).to.equal(await registry.primeBarrel());
    });

    it("il Prime Barrel si apre una volta sola", async function () {
      const { registry, dai, stranger } = await networkHelpers.loadFixture(deployFixture);
      await expect(registry.createPrimeBarrel("Un altro", dai, stranger.address)).to.be.revertedWithCustomError(
        registry,
        "PrimeBarrelAlreadyOpen",
      );
    });

    it("crea un pool con nome, creatore e blocco", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);

      const tx = await registry.connect(stranger).createPool("Sector-7 Crude", BASIC, ZERO, ZERO, { value: FEE });
      const receipt = await tx.wait();

      expect(await registry.poolsCount()).to.equal(2n);

      const tutti = await registry.getAllPools();
      const pool = tutti[tutti.length - 1];
      expect(pool.name).to.equal("Sector-7 Crude");
      expect(pool.creator).to.equal(stranger.address);
      expect(pool.creationBlock).to.equal(BigInt(receipt!.blockNumber));
      expect(pool.kind).to.equal(BASIC);
    });

    it("apre anche barili di tipo 1, sul token scelto", async function () {
      const { registry, dai, stranger } = await networkHelpers.loadFixture(deployFixture);
      await registry.createPool("Tipo uno", AAVE, dai, stranger.address, { value: FEE });

      const tutti = await registry.getAllPools();
      const pool = tutti[tutti.length - 1];
      expect(pool.kind).to.equal(AAVE);
      expect(pool.name).to.equal("Tipo uno");
      expect(pool.asset).to.equal(ethers.getAddress(dai));
      expect(pool.assetSymbol).to.equal("DAI");
      expect(pool.beneficiary).to.equal(stranger.address);
      expect(pool.totalAssets).to.equal(0n);
      expect(pool.principal).to.equal(0n);
    });

    it("i token disponibili sono le riserve di Aave", async function () {
      const { registry, dai } = await networkHelpers.loadFixture(deployFixture);
      const assets = await registry.getAssets();

      expect(assets.length).to.be.greaterThan(1);
      expect(assets.map((a: { token: string }) => a.token)).to.include(ethers.getAddress(dai));
      // ognuna porta con sé il proprio aToken e i propri decimali
      for (const asset of assets) {
        expect(asset.aToken).to.not.equal(ZERO);
        expect(asset.symbol).to.not.equal("");
      }
    });

    it("rifiuta un barile di tipo 1 su un token che Aave non tratta", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        registry.createPool("Ignoto", AAVE, stranger.address, stranger.address, { value: FEE }),
      ).to.be.revertedWithCustomError(registry, "UnknownAsset");
    });

    it("rifiuta un barile di tipo 1 senza un indirizzo per il surplus", async function () {
      const { registry, dai } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        registry.createPool("Senza destinatario", AAVE, dai, ZERO, { value: FEE }),
      ).to.be.revertedWithCustomError(registry, "NoBeneficiary");
    });

    it("rifiuta chi paga meno della tariffa", async function () {
      const { registry } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        registry.createPool("Troppo poco", BASIC, ZERO, ZERO, { value: FEE - 1n }),
      ).to.be.revertedWithCustomError(registry, "FeeNotCovered");
    });

    it("rifiuta il nome vuoto", async function () {
      const { registry } = await networkHelpers.loadFixture(deployFixture);
      await expect(registry.createPool("", BASIC, ZERO, ZERO, { value: FEE })).to.be.revertedWithCustomError(
        registry,
        "EmptyName",
      );
    });

    it("restituisce il resto a chi paga di più", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);
      const before = await ethers.provider.getBalance(stranger.address);

      const tx = await registry.connect(stranger).createPool("Paga troppo", BASIC, ZERO, ZERO, { value: FEE * 3n });
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;

      const after = await ethers.provider.getBalance(stranger.address);
      expect(before - after - gas).to.equal(FEE);
    });

    it("non conosce indirizzi che non sono suoi pool", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);
      await expect(registry.getPoolInfo(stranger.address)).to.be.revertedWithCustomError(registry, "UnknownPool");
    });
  });

  describe("Tariffa", function () {
    it("il proprietario la cambia", async function () {
      const { registry } = await networkHelpers.loadFixture(deployFixture);
      await registry.setCreationFee(FEE * 2n);
      expect(await registry.creationFee()).to.equal(FEE * 2n);

      await registry.createPool("Al prezzo nuovo", BASIC, ZERO, ZERO, { value: FEE * 2n });
      expect(await registry.poolsCount()).to.equal(2n);
    });

    it("chiunque altro non la tocca", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);
      await expect(registry.connect(stranger).setCreationFee(0n)).to.be.revertedWithCustomError(registry, "NotOwner");
    });
  });

  describe("Cassa", function () {
    it("il proprietario ritira quanto incassato", async function () {
      const { registry, owner, stranger } = await networkHelpers.loadFixture(deployFixture);
      await registry.connect(stranger).createPool("Uno", BASIC, ZERO, ZERO, { value: FEE });
      await registry.connect(stranger).createPool("Due", BASIC, ZERO, ZERO, { value: FEE });

      const before = await ethers.provider.getBalance(owner.address);
      const tx = await registry.withdraw(owner.address);
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(owner.address);

      expect(after - before + gas).to.equal(FEE * 2n);
      expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(0n);
    });

    it("chiunque altro non ritira", async function () {
      const { registry, stranger } = await networkHelpers.loadFixture(deployFixture);
      await registry.connect(stranger).createPool("Uno", BASIC, ZERO, ZERO, { value: FEE });
      await expect(registry.connect(stranger).withdraw(stranger.address)).to.be.revertedWithCustomError(
        registry,
        "NotOwner",
      );
    });
  });
});
