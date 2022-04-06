describe('Create a new treasury', () => {
  it('Should show new treasury form', () => {
    cy.visit('http://localhost:3000/')
    cy.contains('New Treasury').click()
    cy.url().should('eq', 'http://localhost:3000/treasuries/new')
  })
  it('Should fill title and description', () => {
    cy.fixture('treasuryData').then((treasuryData) => {
      cy.get('input[placeholder="Write Name"]')
        .type(treasuryData.treasuryName)
        .should("have.value", treasuryData.treasuryName);

      cy.get('textarea[placeholder="Describe the treasury"]')
        .type(treasuryData.treasuryDesc)
        .should("have.value", treasuryData.treasuryDesc)
    })
  })

  it('Should add signers', () => {
    cy.contains('Add').should('be.disabled')
    var signers = 0
    cy.fixture('treasuryData').then((treasuryData) => {
      treasuryData.addresses.map((address: string) => {
        cy.get('textarea[placeholder="Add signer address and press enter"]')
          .type(address)
          .should("have.value", address)
        cy.contains('Add').should('be.enabled')
        cy.contains('Add').click()
        cy.contains('Add').should('be.disabled')
        signers++;
        cy.contains('Signers').parent().find('ul').children().should('have.length', signers)
      })
    })
    //TODO: check amount of signatures is correct and that each signature has a corresponding public key
  })
  //TODO: add test to check if add button is disabled when using wrong address
  
  it('Should limit required signers to amount of signers added to treasury', () => {
    cy.contains('Required Signers').parent().find('select').select('At least')
    cy.contains('Required Signers').parent().find('input').type('{selectall}{backspace}')
    cy.contains('Required Signers').parent().find('input').type('100')
    cy.fixture('treasuryData').then((treasuryData) => {
      cy.contains('Required Signers').parent().find('input').should('have.value', treasuryData.addresses.length.toString())
    })
  })

  it('Should save treasury', () => {
    cy.contains('Required Signers').parent().find('input').type('{selectall}{backspace}')
    cy.contains('Required Signers').parent().find('input').type('2')
    cy.contains('Save Treasury').should('be.enabled')
    cy.contains('Save Treasury').click()
    cy.wait(1500)
    cy.fixture('treasuryData').then((treasuryData) => {
      cy.contains(treasuryData.treasuryName).click()
    })
    cy.url().should('eq', 'http://localhost:3000/treasuries/gwMCgoIAWBz2v%2FtCURgnKF2D4mFnXqjUTGnZS54dlZQ1d90KggBYHOHZFcEMhAAXvTkIioJQeycVCkOOiQd4QiFJEwk%3D')
  })
})
