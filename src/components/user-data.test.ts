import { serializeUserData, deserializeUserData } from "./user-data"
import type { UserData } from "./user-data"

test('UserData', () => {
  const userData: UserData = {
    network: 'preview',
    version: '2',
    multisigWallets: [{
      id: 'addr_test1xpff750879d8u3wvl9yhedaff0gv8zmecxzae3h9ty9wrtz9uf28cs7rk7m67rmse675wltjhya740893pwzgkvqqh8q67usf2',
      name: 'MWallet',
      description: 'xxx',
      policy: { type: 'All', policies: ['addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t'] },
      updatedAt: new Date()
    }],
    personalWallets: [{
      id: 0,
      hash: new Uint8Array([0]),
      rootKey: new Uint8Array([1]),
      updatedAt: new Date(),
      name: 'PW',
      description: 'lol',
      personalAccounts: new Map([[0, {
        publicKey: new Uint8Array([3]),
        paymentKeyHashes: [new Uint8Array([4])]
      }]]),
      multisigAccounts: new Map([[0, {
        publicKey: new Uint8Array([5]),
        addresses: [{ paymentKeyHash: new Uint8Array([6]), stakingKeyHash: new Uint8Array([7]) }]
      }]])
    }],
    keyHashIndices: [{
      hash: new Uint8Array([8]),
      derivationPath: [],
      walletId: 0
    }]
  }

  const dataJSON = serializeUserData(userData)
  const parsedData = deserializeUserData(dataJSON)

  expect(parsedData.network).toBe('preview')
  expect(parsedData.version).toBe('2')
  expect(parsedData.multisigWallets.length).toBe(1)

  const multisigWallet = parsedData.multisigWallets[0]
  expect(multisigWallet.id).toBe('addr_test1xpff750879d8u3wvl9yhedaff0gv8zmecxzae3h9ty9wrtz9uf28cs7rk7m67rmse675wltjhya740893pwzgkvqqh8q67usf2')
  expect(multisigWallet.name).toBe('MWallet')
  expect(multisigWallet.description).toBe('xxx')
  if (typeof multisigWallet.policy === 'string') throw new Error('Wrong policy')
  expect(multisigWallet.policy.type).toBe('All')
  expect(parsedData.personalWallets.length).toBe(1)

  const personalWallet = parsedData.personalWallets[0]
  expect(personalWallet.id).toBe(0)
  expect(personalWallet.hash[0]).toBe(0)
  expect(personalWallet.rootKey[0]).toBe(1)
  expect(personalWallet.name).toBe('PW')
  expect(personalWallet.description).toBe('lol')
  expect(personalWallet.personalAccounts.size).toBe(1)

  const personalAccount = personalWallet.personalAccounts.get(0)
  expect(personalAccount?.publicKey[0]).toBe(3)
  expect(personalAccount?.paymentKeyHashes[0][0]).toBe(4)

  const multisigAccount = personalWallet.multisigAccounts.get(0)
  expect(multisigAccount?.publicKey[0]).toBe(5)
  expect(multisigAccount?.addresses[0].paymentKeyHash[0]).toBe(6)
  expect(multisigAccount?.addresses[0].stakingKeyHash[0]).toBe(7)

  const keyHashIndex = parsedData.keyHashIndices[0]
  expect(keyHashIndex?.hash[0]).toBe(8)
  expect(keyHashIndex?.walletId).toBe(0)
})
