import type { Address, NativeScript, NativeScripts, Transaction, TransactionBody, TransactionOutput, Vkeywitness } from '@emurgo/cardano-serialization-lib-browser'
import { useEffect, useState } from 'react'
import { NextPage } from 'next'
import GUN from "gun";
import { sign } from 'crypto';

const SyncToggle: NextPage<{
  signatureMap: Map<string, string>,
  txHash: string,
  signHandle: (_: string) => void
}> = (props) => {
  //const [gun, setGun] = useState<typeof GUN>()
  const [toggled, setToggled] = useState(true)
  const [loadedSignatures, setLoadedSignatures] = useState<string[]>([])
  const gun = GUN(['https://dao-gunjs.herokuapp.com/gun'])

  useEffect(() => {
    if (toggled) {
      console.log("activated")
      let i = 0;
      var signatures: string[] = [...loadedSignatures];
      gun.get(props.txHash).map().on((data) => {
        let sig: string = data.sig
        if (!signatures.includes(sig)) {
          signatures.push(sig)
          setLoadedSignatures(signatures)
          i++;
          setTimeout(() => {
            props.signHandle(sig)
          }, 1000 * i)
        }
      })
    } else {
      console.log("deactivated")
    }
  }, [toggled])

  useEffect(() => {
    console.log("sig map:", props.signatureMap)
    props.signatureMap.forEach((sig, hex) => {
      if (!loadedSignatures.includes(sig)) {
        gun.get(props.txHash).get(hex).put({ sig: sig })
      }
    })
  }, [props.signatureMap])

  return (
    <div className="mb-2">
      <div className="form-switch inline-block align-middle">
        <input type="checkbox" name="1" id="1" checked={toggled} className="form-switch-checkbox" onChange={() => setToggled(!toggled)} />
        <label className="form-switch-label" htmlFor="1"></label>
      </div>
      <label htmlFor="1">Live sync</label>
    </div>
  )
}

export { SyncToggle }