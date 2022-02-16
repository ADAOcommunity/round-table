import type { NextPage } from 'next'
import { useRouter } from 'next/router'

const Script: NextPage = () => {
  const router = useRouter()
  const { script } = router.query

  return <p>Script: {script}</p>
}

export default Script
