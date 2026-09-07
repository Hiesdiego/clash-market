import "server-only";

import {
  createPublicClient,
  createWalletClient,
  parseEther,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { somniaTestnet, COLLATERAL } from "@/lib/chains/somnia";
import { getEnv } from "@/lib/env";
import { createRpcFallbackTransport } from "@/lib/chains/rpc";

const tusdcAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

function buildFaucetClients() {
  const env = getEnv();
  if (!env.FAUCET_PRIVATE_KEY) {
    throw new Error("The testnet faucet is not configured");
  }

  const account = privateKeyToAccount(env.FAUCET_PRIVATE_KEY as Hex);
  const transport = createRpcFallbackTransport([
    somniaTestnet.rpcUrls.default.http[0],
    env.VALIDATION_CLOUD_RPC,
  ]);
  const publicClient = createPublicClient({ chain: somniaTestnet, transport });
  const walletClient = createWalletClient({ account, chain: somniaTestnet, transport });

  return { account, publicClient, walletClient };
}

let clients: ReturnType<typeof buildFaucetClients> | null = null;

function getFaucetClients() {
  if (!clients) clients = buildFaucetClients();
  return clients;
}

export function getFaucetAmounts() {
  const env = getEnv();
  return {
    stt: parseEther(env.FAUCET_STT_AMOUNT),
    tusdc: parseUnits(env.FAUCET_TUSDC_AMOUNT, COLLATERAL.testnet.decimals),
    sttLabel: env.FAUCET_STT_AMOUNT,
    tusdcLabel: env.FAUCET_TUSDC_AMOUNT,
  };
}

export async function sendFaucetPayout(
  recipient: Address,
  onTransactionSent?: (kind: "stt" | "tusdc", hash: Hex) => Promise<void>,
) {
  const { account, publicClient, walletClient } = getFaucetClients();
  const amounts = getFaucetAmounts();

  const [nativeBalance, tokenBalance, gasPrice, nativeGas, tokenGas] = await Promise.all([
    publicClient.getBalance({ address: account.address }),
    publicClient.readContract({
      address: COLLATERAL.testnet.address as Address,
      abi: tusdcAbi,
      functionName: "balanceOf",
      args: [account.address],
    }),
    publicClient.getGasPrice(),
    publicClient.estimateGas({
      account,
      to: recipient,
      value: amounts.stt,
    }),
    publicClient.estimateContractGas({
      account,
      address: COLLATERAL.testnet.address as Address,
      abi: tusdcAbi,
      functionName: "transfer",
      args: [recipient, amounts.tusdc],
    }),
  ]);

  const estimatedGasCost = (nativeGas + tokenGas) * gasPrice;
  if (nativeBalance < amounts.stt + estimatedGasCost) {
    throw new Error("The faucet is temporarily out of STT");
  }
  if (tokenBalance < amounts.tusdc) {
    throw new Error("The faucet is temporarily out of tUSDC");
  }

  // Send native STT first so the recipient can immediately pay for a normal
  // Privy transaction. The claim row stores each hash to make partial payouts
  // visible and prevent accidental duplicate grants.
  const sttTxHash = await walletClient.sendTransaction({
    account,
    chain: somniaTestnet,
    to: recipient,
    value: amounts.stt,
  });
  await onTransactionSent?.("stt", sttTxHash);
  await publicClient.waitForTransactionReceipt({ hash: sttTxHash });

  const tusdcTxHash = await walletClient.writeContract({
    account,
    chain: somniaTestnet,
    address: COLLATERAL.testnet.address as Address,
    abi: tusdcAbi,
    functionName: "transfer",
    args: [recipient, amounts.tusdc],
  });
  await onTransactionSent?.("tusdc", tusdcTxHash);
  await publicClient.waitForTransactionReceipt({ hash: tusdcTxHash });

  return { sttTxHash, tusdcTxHash, ...amounts };
}
