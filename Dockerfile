FROM node:18-alpine as dependencies

RUN apk add --no-cache libc6-compat

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM node:18-alpine as builder
WORKDIR /app
COPY . .
COPY --from=dependencies /app/node_modules ./node_modules

ARG NEXT_PUBLIC_NETWORK='mainnet'
ENV NEXT_PUBLIC_NETWORK $NEXT_PUBLIC_NETWORK

ARG NEXT_PUBLIC_GRAPHQL='https://graphql.lidonation.com'
ENV NEXT_PUBLIC_GRAPHQL $NEXT_PUBLIC_GRAPHQL

ARG NEXT_PUBLIC_SUBMIT='https://tx.lidonation.com;https://adao.panl.org;https://submit-api.apexpool.info/api/submit/tx'
ENV NEXT_PUBLIC_SUBMIT $NEXT_PUBLIC_SUBMIT


ARG NEXT_PUBLIC_GUN=''
ENV NEXT_PUBLIC_GUN $NEXT_PUBLIC_GUN

RUN yarn build

FROM node:18-alpine as runner
ENV NODE_ENV production
WORKDIR /app
USER node

COPY --chown=node --from=builder /app/public ./public
COPY --chown=node --from=builder /app/.next ./.next
COPY --chown=node --from=builder /app/node_modules ./node_modules
COPY --chown=node --from=builder /app/package.json ./package.json

EXPOSE 3000

ENV PORT 3000

CMD ["yarn", "start"]
