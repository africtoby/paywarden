# Contributing

Thanks for taking a look. This is a small project, so keep changes focused.

## Set up

See the README for the full setup. In short:

```bash
cd contracts && forge test                 # contracts
cd agent && npm install && npm test        # agent
cd web && npm install && npm run lint && npx vitest run   # web
```

Use test wallets and test tokens only. Never commit `.env` files or keys.

## Pull requests

- One change per pull request, with a short description of what and why.
- Contract changes need tests, including the revert paths. Run `forge test` and `forge coverage --report summary`.
- Web changes should pass `npm run lint` and `npx tsc --noEmit`.
- Match the style of the surrounding code.
