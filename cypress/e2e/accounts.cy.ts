describe('Create a new account', () => {
  const accountName = "Test account"
  const accountDesc = "This is a description of the account"
  const addresses = [
    "addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t",
    "addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj"
  ]
  const addedName = 'added'
  const addedDesc = 'xxx'
  const editedName = accountName + addedName
  const editedDesc = accountDesc + addedDesc

  it('Should show new account form', () => {
    cy.visit('http://localhost:3000/')

    cy.contains('New Account')
      .click()

    cy.url()
      .should('eq', 'http://localhost:3000/accounts/new')
  })

  it('Should fill title and description', () => {
    cy.get('input[placeholder="Write Name"]')
      .type(accountName)
      .should("have.value", accountName);

    cy.get('textarea[placeholder="Describe the account"]')
      .type(accountDesc)
      .should("have.value", accountDesc)
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

  it('Should limit required signers to amount of signers added to account', () => {
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

  it('Should save account', () => {
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

    cy.wait(1500)

    cy.contains(accountName).click()

    cy.url().should('eq', 'http://localhost:3000/accounts/%7B%22type%22%3A%22NofK%22%2C%22policies%22%3A%5B%22addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t%22%2C%22addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj%22%5D%2C%22number%22%3A2%7D')
  })

  it('Should edit account info', () => {
    cy.contains('Edit')
      .click()

    cy.get('input[placeholder="Write Name"]')
      .type(addedName)
      .should("have.value", editedName);

    cy.get('textarea[placeholder="Describe the account"]')
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

  it('Should delete account info', () => {
    cy.visit('http://localhost:3000')

    cy.contains(editedName)
      .click()

    cy.contains('Delete')
      .click()

    cy.get('input[placeholder="Type account name"]')
      .type(editedName)
      .should("have.value", editedName)

    cy.contains('DELETE')
      .click()

    cy.contains(editedName)
      .should('not.exist')
  })

  it('Should import user data', () => {
    cy.visit('http://localhost:3000/config')
    const downloadsFolder = Cypress.config('downloadsFolder')
    const downloadedFilename = downloadsFolder + '/roundtable-backup.testnet.json'

    cy.get('input[type=file]')
      .selectFile(downloadedFilename)

    cy.contains('Import User Data')
      .should('be.enabled')

    cy.contains('Import User Data')
      .click()

    cy.wait(1500)

    cy.contains(accountName + 'added')
      .click()

    cy.url().should('eq', 'http://localhost:3000/accounts/%7B%22type%22%3A%22NofK%22%2C%22policies%22%3A%5B%22addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t%22%2C%22addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj%22%5D%2C%22number%22%3A2%7D')
  })
})
