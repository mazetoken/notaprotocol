import { ref, readonly } from 'vue'
import SignClient from '@walletconnect/sign-client'
import { createAppKit } from '@reown/appkit/core'
import { defineChain } from '@reown/appkit/networks'
import { stringify } from '@bitauth/libauth'

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace with your Project ID from https://dashboard.reown.com
export const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID

const BCH_CHAIN_ID = 'bch:bitcoincash'
const BCH_METHODS  = ['bch_signTransaction', 'bch_getAddresses']
const BCH_EVENTS   = ['addressesChanged']

// Define BCH as a custom chain for AppKit
const bchMainnet = defineChain({
  id: 'bitcoincash',
  name: 'Bitcoin Cash',
  nativeCurrency: { name: 'Bitcoin Cash', symbol: 'BCH', decimals: 8 },
  rpcUrls: { default: { http: ['https://explorer.bch.ninja'] } },
  blockExplorers: { default: { name: 'BCH Explorer', url: 'https://bchexplorer.cash' } },
  chainNamespace: 'bch',
  caipNetworkId: BCH_CHAIN_ID,
})

const DOMAIN = 'https://notaprotocol.netlify.app';

const METADATA = {
  name: 'NOTA Protocol',
  description: 'Broadcast messages on Bitcoin Cash via OP_RETURN',
  url: typeof window !== 'undefined' 
      ? window.location.origin 
      : DOMAIN,
  icons: [],
}

// For local development
if (typeof window === 'undefined') {
  METADATA.url = 'http://localhost:3000'; // Replace with your local development URL
}

// ─── SINGLETON STATE ──────────────────────────────────────────────────────────
let signClientInstance = null
let appKitInstance = null
let initPromise = null

// ─── COMPOSABLE ──────────────────────────────────────────────────────────────
export function useWalletConnect() {
  const address    = ref(null)
  const session    = ref(null)
  const connecting = ref(false)
  const error      = ref(null)
  const ready      = ref(false)

  async function init() {
    if (initPromise) return initPromise
    initPromise = _init()
    return initPromise
    
  }

  async function _init() {
    try {
      if (signClientInstance) {
        restoreSession()
        ready.value = true
        return
      }

      signClientInstance = await SignClient.init({
        projectId: PROJECT_ID,
        metadata: METADATA,
      })

      appKitInstance = createAppKit({
        projectId: PROJECT_ID,
        networks: [bchMainnet],
        manualWCControl: true,
        featuredWalletIds: [],
      })

      // Session lifecycle events
      signClientInstance.on('session_delete', clearSession)
      signClientInstance.on('session_expire', clearSession)

      restoreSession()
      ready.value = true
    } catch (e) {
      error.value = 'WalletConnect init failed: ' + e.message
    }
  }

  function restoreSession() {
    const sessions = signClientInstance.session.getAll()
    if (sessions.length > 0) {
      const last = sessions[sessions.length - 1]
      session.value = last
      extractAddress(last)
    }
  }

  function extractAddress(sess) {
    const accounts = sess?.namespaces?.bch?.accounts ?? []
    if (accounts.length > 0) {
      // accounts[0] format: "bch:bitcoincash:bitcoincash:qr..."
      const parts = accounts[0].split(':')
      const addr = parts[parts.length - 1]
      address.value = addr.startsWith('bitcoincash:') ? addr : `bitcoincash:${addr}`
    }
  }

  function clearSession() {
    session.value = null
    address.value = null
  }

  async function connect() {
    if (!signClientInstance) { error.value = 'Not initialized'; return }
    connecting.value = true
    error.value = null
    try {
      const { uri, approval } = await signClientInstance.connect({
        requiredNamespaces: {
          bch: {
            methods: BCH_METHODS,
            chains: [BCH_CHAIN_ID],
            events: BCH_EVENTS,
          },
        },
      })

      if (uri) {
        // Open the Reown AppKit modal with the WC URI
        appKitInstance.open({ uri })
      }

      const sess = await approval()
      session.value = sess
      extractAddress(sess)
      appKitInstance.close()
    } catch (e) {
      if (e?.message !== 'User rejected') {
        error.value = 'Connection failed: ' + e.message
      }
    } finally {
      connecting.value = false
    }
  }

  async function disconnect() {
    if (!signClientInstance || !session.value) return
    try {
      await signClientInstance.disconnect({
        topic: session.value.topic,
        reason: { code: 6000, message: 'User disconnected' },
      })
    } catch (e) {
      console.warn('Disconnect error:', e)
    }
    clearSession()
  }

  async function signTransaction(wcTransactionObj) {
    if (!signClientInstance || !session.value) throw new Error('Not connected')
    return signClientInstance.request({
      chainId: BCH_CHAIN_ID,
      topic: session.value.topic,
      request: {
        method: 'bch_signTransaction',
        params: JSON.parse(stringify(wcTransactionObj)),
      },
    })
  }

  return {
    address: readonly(address),
    session: readonly(session),
    connecting: readonly(connecting),
    error: readonly(error),
    ready: readonly(ready),
    init,
    connect,
    disconnect,
    signTransaction,
  }
}