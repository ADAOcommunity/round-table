describe('Create a new wallet', () => {
  before(() => {
    window.indexedDB.deleteDatabase('round-table')
  })

  const walletName = "Test wallet"
  const walletDesc = "This is a description of the wallet"
  const addresses = [
    "addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t",
    "addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj"
  ]
  const addedName = 'added'
  const addedDesc = 'xxx'
  const editedName = walletName + addedName
  const editedDesc = walletDesc + addedDesc

  it('Should show new wallet form', () => {
    cy.visit('http://localhost:3000/')

    cy.contains('New Wallet')
      .click()

    cy.url()
      .should('eq', 'http://localhost:3000/new')
  })

  it('Should fill title and description', () => {
    cy.get('input[placeholder="Write Name"]')
      .type(walletName)
      .should("have.value", walletName);

    cy.get('textarea[placeholder="Describe the wallet"]')
      .type(walletDesc)
      .should("have.value", walletDesc)
  })

  it('Should add signers', () => {
    addresses.forEach((address) => {
      cy.contains('Add Signer').click()

      cy.contains('New Signer')
        .should('be.visible')

      cy.get('textarea[placeholder="Add signer address and press enter"]')
        .type(address)
        .should("have.value", address)

      cy.contains('Add Address')
        .should('be.enabled')

      cy.contains('Add Address')
        .click()
    })

    cy.contains('Policy')
      .parent()
      .find('ul')
      .children()
      .should('have.length', 2)

    cy.contains('Add Signer').click()

    cy.contains('Add Address')
      .should('be.disabled')

    cy.get('textarea[placeholder="Add signer address and press enter"]')
      .type("abcdefghijk")

    cy.contains('Add Address')
      .should('be.disabled')

    cy.contains('Cancel').click()
  })

  it('Should limit required signers to amount of signers added to wallet', () => {
    cy.contains('Policy')
      .parent().find('select')
      .select('At least')

    cy.contains('Policy')
      .parent().find('input')
      .type('{selectall}{backspace}')

    cy.contains('Policy')
      .parent().find('input')
      .type('100')

    cy.contains('Policy')
      .parent().find('input')
      .should('have.value', '100')

    cy.contains('Policy')
      .click()

    cy.contains('Policy')
      .parent().find('input')
      .should('have.value', addresses.length.toString())
  })

  it('Should save wallet', () => {
    cy.contains('Policy')
      .parent().find('input')
      .type('{selectall}{backspace}')

    cy.contains('Policy')
      .parent()
      .find('input')
      .type('2')

    cy.contains('Save')
      .should('be.enabled')

    cy.contains('Save')
      .click()

    cy.wait(15000)

    cy.contains(walletName).click()

    cy.url().should('eq', 'http://localhost:3000/multisig/%7B%22type%22%3A%22NofK%22%2C%22policies%22%3A%5B%22addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t%22%2C%22addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj%22%5D%2C%22number%22%3A2%7D')
  })

  it('Should edit wallet info', () => {
    cy.contains('Edit')
      .click()

    cy.get('input[placeholder="Write Name"]')
      .type(addedName)
      .should("have.value", editedName);

    cy.get('textarea[placeholder="Describe the wallet"]')
      .type(addedDesc)
      .should("have.value", editedDesc)

    cy.contains('Save')
      .click()

    cy.contains(editedName)
      .should('be.visible')
  })

  it('Should export user data', () => {
    cy.visit('http://localhost:3000/config')
    cy.contains('Export User Data')
      .click()
  })

  it('Should remove wallet info', () => {
    cy.visit('http://localhost:3000')

    cy.contains(editedName)
      .click()

    cy.contains('Remove')
      .click()

    cy.get('input[placeholder="Type the wallet name to confirm"]')
      .type(editedName)
      .should("have.value", editedName)

    cy.contains('REMOVE')
      .click()

    cy.contains(editedName)
      .should('not.exist')
  })

  it('Should import user data', () => {
    cy.visit('http://localhost:3000/config')
    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = downloadsFolder + '/roundtable-backup.preview.json'

    cy.get('input[type=file]')
      .selectFile(downloadedFilename)

    cy.contains('Import User Data')
      .should('be.enabled')

    cy.wait(5000)

    cy.contains('Import User Data')
      .click()

    cy.contains(walletName + 'added')
      .click()

    cy.url().should('eq', 'http://localhost:3000/multisig/%7B%22type%22%3A%22NofK%22%2C%22policies%22%3A%5B%22addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t%22%2C%22addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj%22%5D%2C%22number%22%3A2%7D')
  })
})
