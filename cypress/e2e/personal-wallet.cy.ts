const walletName = 'Main Wallet'
const password = 'ic{K6Bio"pMS7'
const walletDesc = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
const recoveryPhrase: string[] = [
  'moral', 'equip', 'attract',
  'bacon', 'century', 'glad',
  'frown', 'bottom', 'attitude',
  'base', 'deputy', 'pink',
  'erosion', 'beauty', 'razor',
  'route', 'leave', 'wool',
  'type', 'tell', 'trend',
  'skin', 'weapon', 'blush'
]
const waitTime = 15000

describe('Personal wallet', () => {
  before(() => {
    window.indexedDB.deleteDatabase('round-table')
  })

  it('should be able to recover with recovery phrase', () => {
    cy.visit('http://localhost:3000/')
    cy.get('aside')
      .get('a')
      .contains('New Wallet')
      .click()
    cy.get('div')
      .find('nav button')
      .contains('Personal')
      .click()

    recoveryPhrase.forEach((word, index) => {
      cy.contains('Recovery Phrase')
        .parent()
        .contains((index + 1).toString())
        .next('input')
        .type(word)
        .should('have.value', word)
    })

    cy.contains('Next').click()
  })

  it('should be able to save', () => {
    cy.get('input[placeholder="Write Name"]')
      .type(walletName)
      .should('have.value', walletName)
    cy.get('textarea[placeholder="Describe the wallet"]')
      .type(walletDesc)
      .should('have.value', walletDesc)
    cy.get('input[placeholder="Password"]')
      .type(password)
      .should('have.value', password)
    cy.get('input[placeholder="Repeat password"]')
      .type(password)
      .should('have.value', password)

    cy.contains('Create').click()

    cy.wait(waitTime)

    cy.get('div').should('have.contain.text', 'stake_test1uqhy9wspj5mhwz3jjw5sw7d8750mhqryg93xz562vkjwxpccdkfkl')

    cy.contains('Receive').click()

    cy.contains('addr_test1qry97t0n3a6g4uaj9shz4lz4rsuwsjwaup4te83gaxhageewg2aqr9fhwu9r9yafqau60aglhwqxgstzv9f55edyuvrsku53n7')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/0/0")
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/2/0")

    cy.contains('addr_test1qzn4k2ss3tgdt7ayg44knneavn0e6gemg7al2wptnvv2fsewg2aqr9fhwu9r9yafqau60aglhwqxgstzv9f55edyuvrs0487rk')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/0/1")
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/2/0")

    cy.contains('addr_test1qr32njg56puy8cndc57vukg9205ydze4h9tk0qp2552hwzewg2aqr9fhwu9r9yafqau60aglhwqxgstzv9f55edyuvrs7f7txu')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/0/2")
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/2/0")
  })

  it('should be able to add personal address', () => {
    cy.get('td').should('not.have.text', "m/1852'/1815'/0'/0/6")
    cy.contains('Add Address').click()
    cy.contains("m/1852'/1815'/0'/0/6")
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/2/0")
      .closest('tr')
      .should('have.contain.text', 'addr_test1qrz22ravvdmee9389wvaqgdkfptwzjfv4adut35faeygzsfwg2aqr9fhwu9r9yafqau60aglhwqxgstzv9f55edyuvrsrc0m0h')
  })

  it('should be able to add personal accounts', () => {
    cy.contains('Add Account').click()
    cy.get('input[type="Password"]').type(password)
    cy.get('#modal-root').contains('Confirm').click()
    cy.contains('Add Account').parent().get('select').should('have.value', '1')

    cy.contains('addr_test1qz856plw0a560m23p5j6jwjj3sezjnrya0q6qjs7uezvrzqlcrjtpd2lkd088ka782nu8937fklr5lw75xs49wkhs6gsjyg4yw')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/0/0")
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/2/0")

    cy.contains('addr_test1qz48vjvgvy72z8s9rthx3g64cpenp5g39r6glz3n98zcpkqlcrjtpd2lkd088ka782nu8937fklr5lw75xs49wkhs6gsu2lnfg')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/0/1")
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/2/0")

    cy.contains('addr_test1qrfkagyyk6la02rvrfp7042h6d8e8a5j4depefrac3m94nqlcrjtpd2lkd088ka782nu8937fklr5lw75xs49wkhs6gsp9hpxw')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/0/2")
      .next('td')
      .should('have.text', "m/1852'/1815'/1'/2/0")
  })

  it('should be able to remove account', () => {
    cy.contains('Summary').click()

    cy.wait(waitTime)

    cy.contains('REMOVE').click()
    cy.get('#modal-root').contains('REMOVE').click()

    cy.contains('Add Account').parent().get('select').should('have.value', '0')

    cy.contains('Receive').click()
    cy.contains('addr_test1qry97t0n3a6g4uaj9shz4lz4rsuwsjwaup4te83gaxhageewg2aqr9fhwu9r9yafqau60aglhwqxgstzv9f55edyuvrsku53n7')
      .closest('td')
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/0/0")
      .next('td')
      .should('have.text', "m/1852'/1815'/0'/2/0")
  })

  it('should have multisig addresses created', () => {
    cy.contains('Multisig').click()

    cy.contains('addr_test1qzp420vrmccgp4prr2axyjzvjj0qec8d4wdfhamcr9rw0v2afzulsnxumxuw66c2883rj3hv6027uxcvt4qry92hjess4uch94')
      .closest('td')
      .next('td')
      .should('have.text', "m/1854'/1815'/0'/0/0")
      .next('td')
      .should('have.text', "m/1854'/1815'/0'/2/0")

    cy.contains('addr_test1qpxvl6tnc2d9adsr0p0508xsjxewwsx7snkp3xffgume3qyfn88gvkfnmscje2sazy7mmrsm8n5tkvfr8n7dhezdmhnqng95xm')
      .closest('td')
      .next('td')
      .should('have.text', "m/1854'/1815'/0'/0/1")
      .next('td')
      .should('have.text', "m/1854'/1815'/0'/2/1")
  })

  it('should be able to create multisig wallet', () => {
    cy.contains('New Wallet').click()
    cy.contains('Add Signer').click()
    cy.get('#modal-root').contains(walletName).click()
    cy.get('#modal-root')
      .contains('addr_test1qzp420vrmccgp4prr2axyjzvjj0qec8d4wdfhamcr9rw0v2afzulsnxumxuw66c2883rj3hv6027uxcvt4qry92hjess4uch94')
      .click()
    cy.get('li')
      .should('have.contain.text', 'addr_test1qzp420vrmccgp4prr2axyjzvjj0qec8d4wdfhamcr9rw0v2afzulsnxumxuw66c2883rj3hv6027uxcvt4qry92hjess4uch94')
  })

  it('should be able to sign personal transactions', () => {
    cy.visit('http://localhost:3000/base64/hKYAgYJYIPrhts%2B6OZKM83FFizlaIjZeIG%2FV7j2hqj5EPXQWBbr1AAGCglg5AKdbKhCK0NX7pEVrac89ZN%2BdIztHu%2FU4K5sYpMMuQroBlTd3CjKTqQd5p%2FUfu4BkQWJhU0plpOMHGgAOzBaCWDkAyF8t8490ivOyLC4q%2FFUcOOhJ3eBqvJ4o6a%2FUZy5CugGVN3cKMpOpB3mn9R%2B7gGRBYmFTSmWk4wcaAGiQ2QIaAAK1EQMaAD0gUwSCggCCAFgcLkK6AZU3dwoyk6kHeaf1H7uAZEFiYVNKZaTjB4MCggBYHC5CugGVN3cKMpOpB3mn9R%2B7gGRBYmFTSmWk4wdYHAzLBKcAAKxvP29HJWhW8XJOGpPP0tSX4lgg85sIGgA7ztOg9fY%3D')

    cy.wait(waitTime)

    cy.get('footer').contains('Sign').click()
    cy.get('#modal-root').contains(walletName).click()
    cy.get('#modal-root').get('input').type(password).should('have.value', password)
    cy.get('#modal-root').contains('Sign').click()

    cy.contains('c85f2df38f748af3b22c2e2afc551c38e849dde06abc9e28e9afd467')
      .parent()
      .should('have.class', 'text-green-500')

    cy.contains('2e42ba019537770a3293a90779a7f51fbb8064416261534a65a4e307')
      .parent()
      .should('have.class', 'text-green-500')
  })

  it('should be able to sign multisig transactions', () => {
    cy.visit('http://localhost:3000/base64/hKcAgYJYID8suzDDldXtmJgQSIlDudo6DK9M97u29zCZT%2Bx0dO%2B4AAGCglg5MN2pvVjCEyxN2SovQlroQPC5835EpAYIsN4ETgivQOTCSRD%2FEahABE6qc3O1WDh%2BYaz1IdR8bTLHGgAOzBaCWDkw3am9WMITLE3ZKi9CWuhA8LnzfkSkBgiw3gROCK9A5MJJEP8RqEAETqpzc7VYOH5hrPUh1HxtMscaAGh37QIaAALN%2FQMaAD0jmQSCggCCAVgcr0DkwkkQ%2FxGoQAROqnNztVg4fmGs9SHUfG0yx4MCggFYHK9A5MJJEP8RqEAETqpzc7VYOH5hrPUh1HxtMsdYHDhnoJcpoflUdi7qA1qC4tnToU8fp5GgIu8NokIHWCAyfuLnoW9WFfctNWtc1yQGV9OPdh3ZeR2SxgDHo4kHMggaADvSGaEBgoIBgYIAWBxdSLn4TNzZuO1rCjniOUbs09XuGwxdQDIVV5ZhggGBggBYHINVPYPeMIDUIxq6YkhMlJ4M4O2rmpv3eBlG57H1oRkCoqFjbXNngXgbTXVsdGlzaWcgRGVsZWdhdGlvbiBUZXN0aW5n')

    cy.wait(waitTime)

    cy.get('footer').contains('Sign').click()
    cy.get('#modal-root').contains(walletName).click()
    cy.get('#modal-root').get('input').type(password).should('have.value', password)
    cy.get('#modal-root').contains('Sign').click()

    cy.contains('5d48b9f84cdcd9b8ed6b0a39e23946ecd3d5ee1b0c5d403215579661')
      .parent()
      .should('have.class', 'text-green-500')

    cy.contains('83553d83de3080d4231aba62484c949e0ce0edab9a9bf7781946e7b1')
      .parent()
      .should('have.class', 'text-green-500')
  })

  it('should be able to be backed up', () => {
    cy.visit('http://localhost:3000/config')
    cy.contains('Export User Data')
      .click()
  })

  it('should be able to get removed', () => {
    cy.contains(walletName).click()

    cy.wait(waitTime)

    cy.contains('Remove').click()
    cy.contains('Remove Wallet').parent().get('input').type(walletName)
    cy.get('footer')
      .get('button')
      .contains('REMOVE')
      .click()
  })

  it('should be able to be restored', () => {
    cy.visit('http://localhost:3000/config')
    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = downloadsFolder + '/roundtable-backup.preview.json'

    cy.get('input[type=file]')
      .selectFile(downloadedFilename)

    cy.wait(1000)

    cy.contains('Import User Data')
      .should('be.enabled')
      .click()

    cy.contains(walletName).click()

    cy.wait(waitTime)

    cy.get('div').should('have.contain.text', 'stake_test1uqhy9wspj5mhwz3jjw5sw7d8750mhqryg93xz562vkjwxpccdkfkl')
  })
})
