# Round Table

[![Node.js CI](https://github.com/ADAOcommunity/round-table/actions/workflows/node.js.yml/badge.svg)](https://github.com/ADAOcommunity/round-table/actions/workflows/node.js.yml)
[![Cypress Tests](https://github.com/ADAOcommunity/round-table/actions/workflows/cypress.yml/badge.svg)](https://github.com/ADAOcommunity/round-table/actions/workflows/cypress.yml)

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `pages/index.tsx`. The page auto-updates as you edit the file.

[API routes](https://nextjs.org/docs/api-routes/introduction) can be accessed on [http://localhost:3000/api/hello](http://localhost:3000/api/hello). This endpoint can be edited in `pages/api/hello.ts`.

The `pages/api` directory is mapped to `/api/*`. Files in this directory are treated as [API routes](https://nextjs.org/docs/api-routes/introduction) instead of React pages.

## Environment Variable

* To use it on Cardano Testnet, set `NEXT_PUBLIC_TESTNET=y`. Leave it unset to use the Mainnet.
* To connect it to a GraphQL node, set `NEXT_PUBLIC_GRAPHQL` to the URI of the node.
* To sumbit transactions to a relay, set `NEXT_PUBLIC_SUBMIT` to the URI of the node. **Beware that the server needs a reverse proxy to process CORS request.**
* To sync signatures automatically, set `NEXT_PUBLIC_GUN` to the URIs of the peers, split the URIs with `;`. We use [GUN](https://gun.eco) to sync.

## Testing

* To run Unit Tests, use `yarn test` command.
* To run UI/UX Tests, use `yarn cypress` command. Make sure your dev server `http://localhost:3000/` is on. Or use `yarn cypress:headless` to run it in headless mode.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
