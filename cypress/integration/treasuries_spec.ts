describe('Create a new treasury', () => {
  it('Should show new treasury form', () => {
    cy.visit('http://localhost:3000/')
    cy.contains('New Treasury').click()
    cy.url().should('eq', 'http://localhost:3000/treasuries/new')
  })
})
