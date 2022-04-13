const treasuryName = "Test treasury"
const treasuryDesc = "This is a description of the treasury"
const addresses = [
  "addr_test1qrmtl76z2yvzw2zas03xze674r2yc6wefw0pm9v5x4ma6zs45zncsuzyfftj8x2ecg69z5f7x2f3uyz6c38uaeftsrdqms6z7t",
  "addr_test1qrsaj9wppjzqq9aa8yyg4qjs0vn32zjr36ysw7zzy9y3xztl9fadz30naflhmq653up3tkz275gh5npdejwjj23l0rdquxfsdj"
]

describe('Create a new treasury', () => {
  it('Should show new treasury form', () => {
    cy.visit('http://localhost:3000/')

    cy.contains('New Treasury')
      .click()

    cy.url()
      .should('eq', 'http://localhost:3000/treasuries/new')

    cy.contains('New Signer (min. 2)')
      .should('be.visible')
  })

  it('Should fill title and description', () => {
    cy.get('input[placeholder="Write Name"]')
      .type(treasuryName)
      .should("have.value", treasuryName);

    cy.get('textarea[placeholder="Describe the treasury"]')
      .type(treasuryDesc)
      .should("have.value", treasuryDesc)
  })

  it('Should add signers', () => {
    cy.contains('Add')
      .should('be.disabled')

    cy.get('textarea[placeholder="Add signer address and press enter"]')
      .type("abcdefghijk")

    cy.contains('Add')
      .should('be.disabled')

    cy.get('textarea[placeholder="Add signer address and press enter"]')
      .type('{selectall}{backspace}')

    var signers = 0
    addresses.map((address) => {
      cy.get('textarea[placeholder="Add signer address and press enter"]')
        .type(address)
        .should("have.value", address)

      cy.contains('Add')
        .should('be.enabled')

      cy.contains('Add')
        .click()

      cy.contains('Add')
        .should('be.disabled')

      signers++;
      cy.contains('Signers')
        .parent()
        .find('ul')
        .children()
        .should('have.length', signers)
    })
  })
  //TODO: add test to check if add button is disabled when using wrong address

  it('Should limit required signers to amount of signers added to treasury', () => {
    cy.contains('Required Signers')
      .parent().find('select')
      .select('At least')

    cy.contains('Required Signers')
      .parent().find('input')
      .type('{selectall}{backspace}')

    cy.contains('Required Signers')
      .parent().find('input')
      .type('100')

    cy.contains('Required Signers')
      .parent().find('input')
      .should('have.value', '100')

    cy.contains('Required Signers')
      .click()

    cy.contains('Required Signers')
      .parent().find('input')
      .should('have.value', addresses.length.toString())
  })

  it('Should save treasury', () => {
    cy.contains('Required Signers')
      .parent().find('input')
      .type('{selectall}{backspace}')

    cy.contains('Required Signers')
      .parent()
      .find('input')
      .type('2')

    cy.contains('Save Treasury')
      .should('be.enabled')

    cy.contains('Save Treasury')
      .click()

    cy.wait(1500)

    cy.contains(treasuryName).click()

    cy.url().should('eq', 'http://localhost:3000/treasuries/gwMCgoIAWBz2v%2FtCURgnKF2D4mFnXqjUTGnZS54dlZQ1d90KggBYHOHZFcEMhAAXvTkIioJQeycVCkOOiQd4QiFJEwk%3D')
  })

  it('Should edit treasury info', () => {
    const addedName = 'added'
    const addedDesc = 'xxx'
    const editedName = treasuryName + addedName
    const editedDesc = treasuryDesc + addedDesc

    cy.contains('Edit Info')
      .click()

    cy.wait(1500)

    cy.get('input[placeholder="Write Name"]')
      .type(addedName)
      .should("have.value", editedName);

    cy.get('textarea[placeholder="Describe the treasury"]')
      .type(addedDesc)
      .should("have.value", editedDesc)

    cy.contains('Save Treasury')
      .click()

    cy.wait(1500)

    cy.contains(editedName)
      .should('be.visible')

    cy.contains(editedDesc)
      .should('be.visible')
  })

  it('Should export user data', () => {
    cy.visit('http://localhost:3000/config')
    cy.contains('Export User Data')
      .click()
  })

  it('Should delete treasury info', () => {
    cy.visit('http://localhost:3000/treasuries/gwMCgoIAWBz2v%2FtCURgnKF2D4mFnXqjUTGnZS54dlZQ1d90KggBYHOHZFcEMhAAXvTkIioJQeycVCkOOiQd4QiFJEwk%3D')
    cy.contains('Edit Info')
      .click()

    cy.contains('Delete')
      .click()

    cy.url().should('eq', 'http://localhost:3000/treasuries/new')

    cy.contains(treasuryName + 'added')
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

    cy.contains(treasuryName + 'added')
      .click()

    cy.url().should('eq', 'http://localhost:3000/treasuries/gwMCgoIAWBz2v%2FtCURgnKF2D4mFnXqjUTGnZS54dlZQ1d90KggBYHOHZFcEMhAAXvTkIioJQeycVCkOOiQd4QiFJEwk%3D')
  })
})