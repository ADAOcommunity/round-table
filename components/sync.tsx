import type { Address, NativeScript, NativeScripts, Transaction, TransactionBody, TransactionOutput, Vkeywitness } from '@emurgo/cardano-serialization-lib-browser'
import { useEffect, useState } from 'react'
import { toHex, useCardanoSerializationLib } from '../cardano/serialization-lib'
import { NextPage } from 'next'
import GUN from "gun";
import { sign } from 'crypto';

const SyncToggle: NextPage<{
    signatureMap: Map<string, Vkeywitness>,
    base64CBOR: string,
    signHandle: (_: string) => void
}> = (props) => {
    const gun = GUN(['https://dao-gunjs.herokuapp.com/gun'])
    const [toggled, setToggled] = useState(true)
    const cardano = useCardanoSerializationLib()
    const [loadedSignatures, setLoadedSignatures] = useState<string[]>([])

    useEffect(() => {
        if (toggled) {
            var signatures: string[] = loadedSignatures;
            console.log("activated")
            console.log(props.signatureMap)
            let i = 0;
            //------------ GUN JS ----------------------------
            gun.get(props.base64CBOR).map().once((data) => {
                console.log(data)
                i++;
                try {
                    let hexVal = data?.hex
                    let sig: string = data?.sig
                    if (!signatures.includes(sig)) {
                        signatures.push(sig)
                        props.signHandle(sig)
                        setLoadedSignatures(signatures)
                        // console.log("sig", sig)
                    }
                    /* setTimeout(() => {
                        props.signHandle(sig)
                    }, 1000 * i) */
                } catch (e) {
                    console.log(e)
                }
            })
        } else {
            console.log("deactivated")
        }
    }, [toggled])

    useEffect(() => {
        console.log(props.signatureMap)
        props.signatureMap.forEach((vkeyWitness) => {
            const vkey = vkeyWitness.vkey()
            const signature = vkeyWitness.signature()
            const publicKey = vkey.public_key()
            const keyHash = publicKey.hash()
            const hex = toHex(keyHash)
            if (cardano) {
                let sig = cardano?.buildSingleSignatureHex(props.signatureMap.get(toHex(keyHash)) as Vkeywitness)
                if (!loadedSignatures.includes(sig)) {
                    gun.get(props.base64CBOR).set({ hex: hex, sig: sig })
                    console.log(hex)
                }
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