const CHAINGRAPH_URL = 'https://gql.chaingraph.pat.mn/v1/graphql'
// 6a = OP_RETURN, 04 = push 4 bytes, 4e4f5441 = "NOTA"
const NOTA_PREFIX = '6a044e4f5441'

export async function fetchMessages(limit = 50) {
  const query = `
    query {
      search_output_prefix(
        args: { locking_bytecode_prefix_hex: "${NOTA_PREFIX}" }
        where: {
          transaction: {
            block_inclusions: {
              block: { accepted_by: { node: { name: { _regex: "mainnet" } } } }
            }
          }
        }
      ) {
        locking_bytecode
        transaction_hash
        transaction {
          block_inclusions {
            block {
              height
              timestamp
            }
          }
        }
      }
    }
  `

  const res = await fetch(CHAINGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  const json = await res.json()
  //console.log('Chaingraph response:', JSON.stringify(json, null, 2))
  if (json.errors) throw new Error(json.errors[0].message)

  return json.data.search_output_prefix.map(row => ({
    txid: row.transaction_hash.replace('\\x', ''),
    height: row.transaction?.block_inclusions?.[0]?.block?.height ?? null,
    timestamp: row.transaction?.block_inclusions?.[0]?.block?.timestamp ?? null,
    message: decodeOpReturn(row.locking_bytecode ?? ''),
  }))
}

function decodeOpReturn(bytecodeHex) {
  const hex = bytecodeHex.replace('\\x', '')
  try {
    let i = 2 // skip OP_RETURN (6a)
    const chunks = []
    while (i < hex.length) {
      const pushLen = parseInt(hex.slice(i, i + 2), 16)
      i += 2
      chunks.push(hex.slice(i, i + pushLen * 2))
      i += pushLen * 2
    }
    // chunks[0] = NOTA prefix, chunks[1] = version, chunks[2] = message
    const msgHex = chunks[2] ?? ''
    return hexToUtf8(msgHex)
  } catch {
    return '(unreadable)'
  }
}

function hexToUtf8(hex) {
  const bytes = new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)))
  return new TextDecoder().decode(bytes)
}