// Generated from docs/attack-test-results.json (the attack test on Aevum testnet).
// One real on-chain refusal per contract error, linked from the "Try it without a wallet" page.
export const PROOF: Record<string, `0x${string}`> = {
  UnexpectedWallet: "0x10b64ca31c9617ce1a2d1f3eb7ad3ebcf7238c7b81de53d3249f00542cb2cb67",
  NotAgent: "0xd85178d12e48f89bca86f36ef1b62729628af1716fe2d89162f4cb888eaafdf5",
  PerPayeeCapExceeded: "0x78220a17a12e86dedf3631cc03555a6350e476b06ca90b0b841c852b70d41c92",
  PerRunCapExceeded: "0x1eb439e3567f26e4ae823f1d745a8e93b76b7afeb12e2141083bde94fb31edde",
  PeriodCapExceeded: "0x33e2cb0e5af71960629e1f6ee7dc15981d12a4fa5bdb3f23b563eba0096412dd",
  PayeeNotConfirmed: "0xf9356c56264fb72382e8ca51f7edbbeb8aed455c9b20a5c4e4cf79b510a79a1e",
  DuplicatePayee: "0xd2110c4a0a440869d25bb00707c1517af20248e1e47538dd3698972da14ad722",
  EmptyRun: "0x23c08d561a6ae49216a7f04bb4c1cbe49447231edac3bb039d75ea3fa1d94e50",
  LengthMismatch: "0xc5dbcc9ab4103085056f26e1264144ffe16e87509ce1f0ab4c81945de24dbbfc",
  ZeroAmount: "0x9033db4e18b5dfb8e374b687c59ffa9a55a2366ffe5b40b8703d3d4673a9ce82",
  TooManyPayees: "0x588c2d2dbd5d5f989f3ece7020ba0e667ea6803dc9d5bcd4f5f6f673abc06863",
  ReviewWindowOpen: "0x5af83f48216621e3e2d1df22c6546aeb155b1bd6728b97d9fdcedaf077e555d8",
  DuplicateRun: "0x497762eba684edba0e218aaa165c6150d4bf6ee20492e6ab7e3a79eabe8b7cf6",
  OwnableUnauthorizedAccount: "0xd88bc728a1c6e8c1bbabae043d273858bd2872a81ef5927c8ae871b6da589e56",
  RunNotApproved: "0x15e6d65cee46e62883d745823f18ed0fa71151fc0f4d3a7747d25cb2ea606fbe",
  EnforcedPause: "0xf3181bb37f62668b9b1689fac8539585bf549154ba7d69e98acf4966392769d7",
  PolicyExpired: "0x657840caf210735b9e09692209963f533ce58e487fd32fdcd9ae16b812fe5b3c",
  PolicyRevoked: "0x1c3a13ea3965d29c5f966526482a2ff4738953d6ebd20eea395104c63a7badec",
};

/** A real PayWarden payment on Aevum: $0.50 to Ada from the demo vault. */
export const PAID_TX = "0x9a83f5f89a9b6696565c3407ff7577fb2d528e8647efd388db13e54a0b17cf29" as const;
