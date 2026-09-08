import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * I barili nascono a runtime, quindi non compaiono in deployedContracts.ts.
 * Questo script copia la loro ABI nel frontend, dove serve per leggerli e scriverci.
 *
 * Si lancia con `yarn abis:pool`, dopo ogni modifica ai contratti dei pool.
 */
const CONTRACTS = ["AaveFundPool", "AaveTriggerPool", "BasicPool"];
const OUT = path.join(here, "../../nextjs/contracts/poolAbis.ts");

const abiOf = (name: string) => {
  const artifact = path.join(here, `../artifacts/contracts/${name}.sol/${name}.json`);
  return JSON.parse(fs.readFileSync(artifact, "utf8")).abi;
};

const body = CONTRACTS.map(name => {
  const varName = `${name.charAt(0).toLowerCase()}${name.slice(1)}Abi`;
  return `export const ${varName} = ${JSON.stringify(abiOf(name), null, 2)} as const;`;
}).join("\n\n");

fs.writeFileSync(
  OUT,
  `// Generato da packages/hardhat/scripts/exportPoolAbi.ts — rifallo con \`yarn abis:pool\`.
// I pool vengono creati dal registro a runtime: non stanno in deployedContracts.ts,
// e il frontend ha bisogno della loro ABI per parlarci.

${body}
`,
);

console.log(`📝 ABI dei pool scritte in ${path.relative(process.cwd(), OUT)}`);
