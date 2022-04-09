describe('Sign a transaction created by others by import all signatures', () => {
  const URL = 'http://localhost:3000/transactions/hKQAgYJYIEKucajsSuebpzW6sBpzFvZs26rMRiWpIRrpaQqKAciUAQGCglg5AOQS%2Buq87qmsRuz8yOT2uBUUMfIJdTZXihGvyK26Uct0D1jECr5YEqIm8eWO56Vsliz7m98Lf%2BFmghoALcbAoVgcEmuGdkRshKXNbjJZIjsWojFMVna4iuHB%2BFeaj6FEdE1JTgOCWDkwAzhDIFjpiFvESzSX6Dy%2Fj975rmF1Wi9NpzNBbgM4QyBY6YhbxEs0l%2Bg8v4%2Fe%2Ba5hdVovTaczQW6CGgDcpwehWBwSa4Z2RGyEpc1uMlkiOxaiMUxWdriK4cH4V5qPoUd0U1VOREFFAgIaAALHzQdYIFzbYa6%2BdlCcqAXaswMUSXy1JOE0630%2FMDczUy6TY4yPoQGBggGCggBYHH5OXyQPqrEesjaDp7c6U0xWONLGa%2BU0vh3aTaWCAFgc5BL66rzuqaxG7PzI5Pa4FRQx8gl1NleKEa%2FIrfWhGQKioWNtc2eBeBlZZXMsIHRoaXMgaXMgdGhlIG1lc3NhZ2Uu'

  const signatures = 'a100828258205d6be9fd2cfe1c3fa5240ec89ac856b6afa4382ecb1654577a7c73ac517a8bd15840e89c573384f3ca4d8d8d6734bced299e3c5dad67c6c61f3f123efe90359816d9c5aa5ee6e19c70012a635d915f87819508bcd6b7b320be9c27fc1deab68ade0682582057b511ece5ff2cb1f20a72dcb2b2ad4ee3003f65d645a88e66ed2f20c76d49175840d0f654e197d20c09837d04f098daa71f5f2aff83a19cad88a51e2f1a5bde039a1544728375d9fcb7316d0ddd5b210ed0a1bf07a9e85594afe66355b808523809'

  it('Should render the transaction review page', () => {
    cy.visit(URL)

    cy.contains('7e4e5f240faab11eb23683a7b73a534c5638d2c66be534be1dda4da5')
      .parent()
      .should('not.have.class', 'text-green-500')

    cy.contains('e412faeabceea9ac46ecfcc8e4f6b8151431f2097536578a11afc8ad')
      .parent()
      .should('not.have.class', 'text-green-500')
  })

  it('Should import the signatures', () => {
    cy.get('textarea[placeholder="Input signature here and import"]')
      .type(signatures)
      .should("have.value", signatures)

    cy.contains('Import').click()

    cy.contains('7e4e5f240faab11eb23683a7b73a534c5638d2c66be534be1dda4da5')
      .parent()
      .should('have.class', 'text-green-500')

    cy.contains('e412faeabceea9ac46ecfcc8e4f6b8151431f2097536578a11afc8ad')
      .parent()
      .should('have.class', 'text-green-500')
  })
})
