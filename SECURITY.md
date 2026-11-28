# Security policy

PayWarden is a hackathon project that runs on the QDay Aevum **testnet** with test tokens. Do not use it with real funds.

## Reporting a vulnerability

Please report security problems privately, not in a public issue.

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose **Report a vulnerability**. Include the contract, function or file involved, the steps to reproduce, and what an attacker could do.

You can expect an acknowledgement within a few days. Fixes to the contracts need a redeploy, so please give us time to ship one before you publish details.

## Security review

An internal review of the contracts is in [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md): method, tools, every finding and its status. It is not an external audit.

## Known limits

- Confirmation of payee is secret-based: whoever submits a payee's name and salt first is bound to that payee. The owner should check the wallet shown next to each payee before approving a run. See the README for details.
- Never put real private keys in `.env` files that you commit. Use test wallets only.
