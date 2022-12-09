describe('Personal wallet', () => {
  const walletName = 'Main Wallet'
  const walletDesc = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
  const password = 'ic{K6Bio"pMS'
  const recoveryPhrase: string[] = [
    'moral',   'equip',    'attract',
    'bacon',   'century',  'glad',
    'frown',   'bottom',   'attitude',
    'base',    'deputy',   'pink',
    'erosion', 'beauty',   'razor',
    'route',   'leave',    'wool',
    'type',    'tell',     'trend',
    'skin',    'weapon',   'blush'
  ]

  it('should be able to recover with recovery phrase', () => {
    cy.visit('http://localhost:3000/')
    cy.contains('New Wallet').click()
    cy.contains('Personal').click()
    cy.get('input[placeholder="Write Name"]')
      .type(walletName)
      .should('have.value', walletName)
    cy.get('textarea[placeholder="Describe the wallet"]')
      .type(walletDesc)
      .should('have.value', walletDesc)
    cy.get('input[placeholder="Password used when signing transaction"]')
      .type(password)
      .should('have.value', password)
    cy.get('input[placeholder="Repeat password"]')
      .type(password)
      .should('have.value', password)

    recoveryPhrase.forEach((word, index) => {
      cy.contains('Recovery Phrase')
        .parent()
        .contains((index + 1).toString())
        .next('input')
        .type(word)
        .should('have.value', word)
    })

    cy.contains('Create').click()

    cy.wait(10000)

    cy.contains('stake_test1uqhy9wspj5mhwz3jjw5sw7d8750mhqryg93xz562vkjwxpccdkfkl').should('be.visible')

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
})
