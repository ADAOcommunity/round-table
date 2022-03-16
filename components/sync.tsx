import type { Address, NativeScript, NativeScripts, Transaction, TransactionBody, TransactionOutput, Vkeywitness } from '@zqlsg/cardano-serialization-lib-browser'
import { useEffect, useState } from 'react'
import { NextPage } from 'next'
import GUN from "gun";
import { sign } from 'crypto';

const SyncToggle: NextPage<{
  signatureMap: Map<string, string>,
  txHash: string,
  signHandle: (_: string[]) => void
}> = (props) => {
  //const [gun, setGun] = useState<typeof GUN>()
  const [toggled, setToggled] = useState(true)
  const [loadedSignatures, setLoadedSignatures] = useState<string[]>([])
  const [firstLoad, setFirstLoad] = useState(true)


  const gun = GUN(['https://dao-gunjs.herokuapp.com/gun'])

  useEffect(() => {
    gun.get(props.txHash).on((data,key)=>{
    })

    if (toggled) {
      console.log(props.txHash)
      var signatures: string[] = [...loadedSignatures];
      
      gun.get(props.txHash).map().on((data,key) => {
        let sig: string = data.sig
        if (!firstLoad) {
          signatures = [...loadedSignatures]
        }
        if (!signatures.includes(sig) && !firstLoad) {
          signatures.push(sig)
        } else{
          signatures.push(sig)
          setLoadedSignatures(signatures)
          props.signHandle(signatures)
        }
      })
      setFirstLoad(false);
      props.signHandle(signatures)
      setLoadedSignatures(signatures)
    } else {
      console.log("deactivated")
    }
  }, [toggled])

  useEffect(() => {
    var signatures: string[] = [...loadedSignatures];
    props.signatureMap.forEach((sig, hex) => {
      if (!loadedSignatures.includes(sig)) {
        signatures.push(sig)
        props.signHandle([sig])
        gun.get(props.txHash).get(hex).put({ sig: sig })
      }
    })
    setLoadedSignatures(signatures)
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