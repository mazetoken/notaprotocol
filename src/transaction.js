import { ElectrumNetworkProvider, TransactionBuilder, placeholderP2PKHUnlocker } from 'cashscript'

const PROTOCOL_PREFIX = '0x4e4f5441' // "NOTA"
const VERSION_BYTE    = '0x01'
const FEE_RATE            = 1   // sat/byte
const P2PKH_INPUT_BYTES   = 148 // signed P2PKH input
const P2PKH_OUTPUT_BYTES  = 34  // P2PKH output
const TX_OVERHEAD_BYTES   = 10  // version + locktime + varints
const DUST_LIMIT          = 546n

function estimateOpReturnBytes(parts) {
  let size = 1 // OP_RETURN opcode
  for (const part of parts) {
    const hex = part.startsWith('0x') ? part.slice(2) : Buffer.from(part, 'utf8').toString('hex')
    const len = hex.length / 2
    size += len < 76 ? 1 + len : len < 256 ? 2 + len : 3 + len
  }
  return size
}

export async function buildOpReturnTransaction({ address, message, protocolPrefix = PROTOCOL_PREFIX }) {
  const provider = new ElectrumNetworkProvider('mainnet')

  const utxos = await provider.getUtxos(address)
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs found. Fund your wallet with a small amount of BCH first.')
  }

  // Never touch CashToken UTXOs with a plain BCH tx — spending them without
  // re-declaring the token in an output burns it.
  const spendableUtxos = utxos.filter((u) => !u.token)
  if (spendableUtxos.length === 0) {
    throw new Error('All UTXOs carry CashTokens — no pure-BCH UTXOs available without risking a burn.')
  }

  // Largest-first selection: use the fewest inputs needed, which minimizes
  // tx size and therefore fee.
  spendableUtxos.sort((a, b) => (b.satoshis > a.satoshis ? 1 : -1))

  const opReturnParts = [protocolPrefix, VERSION_BYTE, message]
  const opReturnBytes = estimateOpReturnBytes(opReturnParts)

  const selected = []
  let selectedTotal = 0n
  let estimatedFee = 0n

  for (const utxo of spendableUtxos) {
    selected.push(utxo)
    selectedTotal += utxo.satoshis

    const txBytes =
      TX_OVERHEAD_BYTES +
      selected.length * P2PKH_INPUT_BYTES +
      P2PKH_OUTPUT_BYTES +
      opReturnBytes

    estimatedFee = BigInt(Math.ceil(txBytes * FEE_RATE))

    if (selectedTotal >= estimatedFee + DUST_LIMIT) break
  }

  if (selectedTotal < estimatedFee + DUST_LIMIT) {
    throw new Error(
      `Balance too low. Have ${selectedTotal} sats (non-token), need at least ${estimatedFee + DUST_LIMIT} sats.`
    )
  }

  const maximumFeeSatoshis = estimatedFee + 10n // small safety buffer

  const transactionBuilder = new TransactionBuilder({ provider, maximumFeeSatoshis })
  transactionBuilder.addInputs(selected, placeholderP2PKHUnlocker(address))
  transactionBuilder.addOpReturnOutput(opReturnParts)
  transactionBuilder.addOutput({ to: address, amount: selectedTotal - estimatedFee })

  const wcTransactionObj = transactionBuilder.generateWcTransactionObject({
    broadcast: true,
    userPrompt: `Broadcast: "${message.length > 40 ? message.slice(0, 40) + '...' : message}"`,
  })

  return { wcTransactionObj, totalSatoshis: selectedTotal, utxoCount: selected.length, fee: estimatedFee }
}