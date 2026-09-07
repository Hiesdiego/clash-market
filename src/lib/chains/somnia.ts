import { defineChain } from "viem";


export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Shannon Testnet",
  nativeCurrency: { name: "Somnia Test Token", symbol: "STT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: {
      name: "Shannon Explorer",
      url: "https://shannon-explorer.somnia.network",
    },
  },
  testnet: true,
});

export const somniaMainnet = defineChain({
  id: 5031,
  name: "Somnia",
  nativeCurrency: { name: "Somnia", symbol: "SOMI", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.infra.mainnet.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://explorer.somnia.network" },
  },
});

// Core protocol contracts — CREATE3-deployed, identical addresses on both
// networks. Per-market/pool addresses are NEVER hardcoded (they're
// recycled across windows) — always read those from the module registry
// or the SDK at request time.
export const DREAMDEX_CORE_CONTRACTS = {
  // `binaryModule` is the exact key expected by @somnia-chain/markets-sdk.
  // The former `binaryMarketsModule` name was silently ignored, leaving
  // server-side market reads unable to resolve a market on-chain.
  binaryModule: "0x3ecC694Cef705358864a646142ac17A90E29e388",
  marketsCore: "0x2802504314685D89bF6C992CA5a8e7cC78bc0294",
  binarySettlement: "0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23",
  outcomeToken6909: "0xB52c5934113Af5c0Bb20eb3C72290C8215f755b9",
  oracleHub: "0xe40db387cC98601Dd11bd634fF2f3AD5686dE32b",
  collateralRouter: "0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C",
} as const;

export const COLLATERAL = {
  testnet: {
    symbol: "tUSDC",
    address: "0x70a86D8842FB63C4Ad2b7cdddF530eBf1BB25d8E",
    decimals: 6, // derive from decimals() at runtime where it matters — never hardcode in math
  },
  mainnet: {
    symbol: "USDso",
    address: "0x00000022dA000002656c64D9eA6011ea952D008A",
    decimals: 18,
  },
} as const;
