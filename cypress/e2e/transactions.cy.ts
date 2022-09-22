const base64URL = 'http://localhost:3000/base64/hKQAgYJYIEKucajsSuebpzW6sBpzFvZs26rMRiWpIRrpaQqKAciUAQGCglg5AOQS%2Buq87qmsRuz8yOT2uBUUMfIJdTZXihGvyK26Uct0D1jECr5YEqIm8eWO56Vsliz7m98Lf%2BFmghoALcbAoVgcEmuGdkRshKXNbjJZIjsWojFMVna4iuHB%2BFeaj6FEdE1JTgOCWDkwAzhDIFjpiFvESzSX6Dy%2Fj975rmF1Wi9NpzNBbgM4QyBY6YhbxEs0l%2Bg8v4%2Fe%2Ba5hdVovTaczQW6CGgDcpwehWBwSa4Z2RGyEpc1uMlkiOxaiMUxWdriK4cH4V5qPoUd0U1VOREFFAgIaAALHzQdYIFzbYa6%2BdlCcqAXaswMUSXy1JOE0630%2FMDczUy6TY4yPoQGBggGCggBYHH5OXyQPqrEesjaDp7c6U0xWONLGa%2BU0vh3aTaWCAFgc5BL66rzuqaxG7PzI5Pa4FRQx8gl1NleKEa%2FIrfWhGQKioWNtc2eBeBlZZXMsIHRoaXMgaXMgdGhlIG1lc3NhZ2Uu'

const hexURL = 'http://localhost:3000/hex/84a4008182582042ae71a8ec4ae79ba735bab01a7316f66cdbaacc4625a9211ae9690a8a01c89401018282583900e412faeabceea9ac46ecfcc8e4f6b8151431f2097536578a11afc8adba51cb740f58c40abe5812a226f1e58ee7a56c962cfb9bdf0b7fe166821a002dc6c0a1581c126b8676446c84a5cd6e3259223b16a2314c5676b88ae1c1f8579a8fa144744d494e03825839300338432058e9885bc44b3497e83cbf8fdef9ae61755a2f4da733416e0338432058e9885bc44b3497e83cbf8fdef9ae61755a2f4da733416e821a00dca707a1581c126b8676446c84a5cd6e3259223b16a2314c5676b88ae1c1f8579a8fa1477453554e44414502021a0002c7cd0758205cdb61aebe76509ca805dab30314497cb524e134eb7d3f303733532e93638c8fa101818201828200581c7e4e5f240faab11eb23683a7b73a534c5638d2c66be534be1dda4da58200581ce412faeabceea9ac46ecfcc8e4f6b8151431f2097536578a11afc8adf5a11902a2a1636d73678178195965732c207468697320697320746865206d6573736167652e'

function signTransaction() {
  const signatures = 'a100828258205d6be9fd2cfe1c3fa5240ec89ac856b6afa4382ecb1654577a7c73ac517a8bd15840e89c573384f3ca4d8d8d6734bced299e3c5dad67c6c61f3f123efe90359816d9c5aa5ee6e19c70012a635d915f87819508bcd6b7b320be9c27fc1deab68ade0682582057b511ece5ff2cb1f20a72dcb2b2ad4ee3003f65d645a88e66ed2f20c76d49175840d0f654e197d20c09837d04f098daa71f5f2aff83a19cad88a51e2f1a5bde039a1544728375d9fcb7316d0ddd5b210ed0a1bf07a9e85594afe66355b808523809'

  cy.contains('7e4e5f240faab11eb23683a7b73a534c5638d2c66be534be1dda4da5')
    .parent()
    .should('not.have.class', 'text-green-500')

  cy.contains('e412faeabceea9ac46ecfcc8e4f6b8151431f2097536578a11afc8ad')
    .parent()
    .should('not.have.class', 'text-green-500')

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
}

describe('Sign a base64 transaction created by others', () => {
  it('Should sign the transaction', () => {
    cy.visit(base64URL)
    signTransaction()
  })
})

describe('Sign a base64 transaction created by others by opening URL in Base64', () => {
  it('Should sign the transaction', () => {
    cy.visit('http://localhost:3000/open')
    cy.get('textarea[placeholder="URL or CBOR in Hex"]')
      .type(base64URL)
      .should("have.value", base64URL)
    cy.contains('Review Transaction').click()

    signTransaction()
  })
})

describe('Sign a hex transaction created by others', () => {
  it('Should sign the transaction', () => {
    cy.visit(hexURL)
    signTransaction()
  })
})
