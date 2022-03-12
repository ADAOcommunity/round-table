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
    //setGun(Gun)
    if (toggled) {
      console.log("activated")
      let i = 0;
      //------------ GUN JS ----------------------------
      gun.get(props.txHash).map().on((data) => {
        var signatures: string[] = loadedSignatures;
        i++;
        try {
          let hexVal = data?.hex
          let sig: string = data?.sig
          if (!signatures.includes(sig)) {
            signatures.push(sig)
            //props.signHandle(sig)
            //console.log(props.signatureMap)
            setLoadedSignatures(signatures)
          }
        } catch (e) {
          console.log(e)
        }
      })
    } else {
      console.log("deactivated")
    }
  }, [toggled])

  useEffect(() => {
    console.log("sig map:",props.signatureMap)
    props.signatureMap.forEach((sig, hex) => {
      if (!loadedSignatures.includes(sig)) {
        gun?.get(props.txHash).set({ hex: hex, sig: sig })
      }
    })
  }, [props.signatureMap])

  useEffect(()=>{
    console.log("loaded sigs:",loadedSignatures)
    var i=0;
    for(let sig of loadedSignatures){
      i++;
      setTimeout(()=>{
        props.signHandle(sig)
      },1000*i)
    }
  },[loadedSignatures])

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