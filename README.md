# Round Table

[![Node.js CI](https://github.com/ADAOcommunity/round-table/actions/workflows/node.js.yml/badge.svg)](https://github.com/ADAOcommunity/round-table/actions/workflows/node.js.yml)
[![Cypress Tests](https://github.com/ADAOcommunity/round-table/actions/workflows/cypress.yml/badge.svg)](https://github.com/ADAOcommunity/round-table/actions/workflows/cypress.yml)

Round Table is ADAO Community’s open-source wallet on Cardano blockchain. It aims at making multisig easy and intuitive for everyone. The project is designed and developed with decentralization in mind. All the libraries and tools were chosen in favor of decentralization. There is no server to keep your data. Your data is your own. It runs on your browser just like any other light wallets. You could also run it on your own PC easily.

Round Table supports multisig wallets as well as personal wallets. Besides its personal wallets, these wallets are supported to make multisig wallets.

We have an active and welcoming community. If you have any issues or questions, feel free to reach out to us via [Twitter](https://twitter.com/adaocommunity) of [Discord](https://discord.gg/BGuhdBXQFU)

## Getting Started

This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

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

* To use it on Cardano Preview Testnet, set `NEXT_PUBLIC_NETWORK=preview`. Leave it unset to use the Mainnet.
* To connect it to a GraphQL node, set `NEXT_PUBLIC_GRAPHQL` to the URI of the node.
* To sumbit transactions to relays, set `NEXT_PUBLIC_SUBMIT` to the URI of the node, split the URIs with `;`. **Beware that the server needs a reverse proxy to process CORS request.**
* To sync signatures automatically, set `NEXT_PUBLIC_GUN` to the URIs of the peers, split the URIs with `;`. We use [GUN](https://gun.eco) to sync.

## Testing

* To run Unit Tests, use `yarn test` command.
* To run UI/UX Tests, use `yarn cypress` command. Make sure your dev server `http://localhost:3000/` is on. Or use `yarn cypress:headless` to run it in headless mode.

## Running with docker-compose
1. Make sure you have docker and docker-compose installed on your system
2. Create secrets 
    ```bash
    mkdir -p ./.secrets &&\
    echo cexplorer > ./.secrets/postgres_db &&\
    echo postgres > ./.secrets/postgres_user &&\
    echo 6v8hl32432HHlIurYupj5 > ./.secrets/postgres_password
   ```
3. Create system environment variables  
    `cp env.system.example .env.system`  
    Change or set values in `.env.system`
4. Create data directories
    `mkdir -p ./data/cardano/cnode`
5. Download snapshots for quick startup (optional)
   1. *Node Snapshot* Follow instructions here: https://csnapshots.io/about and make sure files are expanded into `./data/cardano/node`
   2. Get a snapshot for your version and set the RESTORE_SNAPSHOT environment variable in `.env.system`.   
    ie:
      ``` 
      RESTORE_SNAPSHOT=https://update-cardano-mainnet.iohk.io/cardano-db-sync/13/db-sync-snapshot-schema-13-block-8371499-x86_64.tgz
      ```
6. Start services
   ```bash
    docker compose --env-file .env.system up
   ```
7. View applications
   8. roundtable ui: http://localhost:3000/. Here you can import previous rt backup and sign txs.
   9. GrapQL Playground: http://localhost:3001/. Here devs can run test GraphQL queries. 

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Deploy on Docker locally

In the project folder, run:

```sh
docker build -t round-table .
docker run -d -p 3000:3000 --name round-table round-table
```

Then visit http://localhost:3000/

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
