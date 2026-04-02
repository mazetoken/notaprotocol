import { ElectrumNetworkProvider, TransactionBuilder, placeholderP2PKHUnlocker } from 'cashscript'

const PROTOCOL_PREFIX = '0x4e4f5441' // "NOTA"
const VERSION_BYTE    = '0x01' // version

export async function buildOpReturnTransaction({ address, message, protocolPrefix = PROTOCOL_PREFIX }) {
  const provider = new ElectrumNetworkProvider('mainnet')

  const utxos = await provider.getUtxos(address)
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs found. Fund your wallet with a small amount of BCH first.')
  }

  const total = utxos.reduce((sum, u) => sum + u.satoshis, 0n)
  if (total <= 546n) {
    throw new Error(`Balance too low (${total} sats). Need more than 546 satoshis to cover the fee.`)
  }

  const maximumFeeSatoshis = 546n;

  const transactionBuilder = new TransactionBuilder({ provider, maximumFeeSatoshis })
  transactionBuilder.addInputs(utxos, placeholderP2PKHUnlocker(address))
  transactionBuilder.addOpReturnOutput([protocolPrefix, VERSION_BYTE, message])
  transactionBuilder.addOutput({ to: address, amount: total - maximumFeeSatoshis})

  const wcTransactionObj = transactionBuilder.generateWcTransactionObject({
    broadcast: true,
    userPrompt: `Broadcast: "${message.length > 40 ? message.slice(0, 40) + '...' : message}"`,
  })

  return { wcTransactionObj, totalSatoshis: total, utxoCount: utxos.length }
}